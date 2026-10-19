
import { OnModuleDestroy, OnModuleInit, BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TreeService } from '../tree/tree.service';
import { MailService, malaysiaTime } from '../../mail/mail.service';

// Login refusals for the wrong sign-in page. The frontend matches on "staff".
const NOT_STAFF = 'This is not a staff account. Sign in on the normal login page.';
const STAFF_ONLY = 'Staff accounts sign in through "Sign in as staff", with email and password.';
const STAFF_PASSWORD_ONLY = 'Staff sign in with email and password, not Google.';

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(AuthService.name);
	private supabase: SupabaseClient;

	constructor(
		private readonly prisma: PrismaService,
		private readonly jwt: JwtService,
		private readonly config: ConfigService,
		private readonly trees: TreeService,
		private readonly mail: MailService,
	) {
		const supabaseUrl = this.config.get<string>('SUPABASE_AUTH_URL');
		const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
		if (!supabaseUrl || !supabaseKey) {
			throw new Error('Supabase credentials missing');
		}
		this.supabase = createClient(supabaseUrl, supabaseKey);
	}

	async loginWithSupabaseToken(accessToken: string, portal?: 'staff') {
		// 1. Verify the token with Supabase
		const { data, error } = await this.supabase.auth.getUser(accessToken);
		if (error || !data.user) {
			throw new UnauthorizedException('Invalid Supabase token');
		}

		const supabaseUser = data.user;

		// Staff sign in with email + password only, never Google.
		if (portal === 'staff' && !this.signedInWithPassword(accessToken)) {
			throw new ForbiddenException(STAFF_PASSWORD_ONLY);
		}

		// Site admins are their own accounts (Admin table) and sign in on the
		// staff page only, everyone else on the normal login (like 42's "Sign in
		// as staff"). Checked before MFA, so the wrong page doesn't even get as
		// far as asking for a code.
		const admin = await this.prisma.admin.findUnique({ where: { id: supabaseUser.id } });
		if (portal === 'staff') {
			// The staff page never creates accounts: admins are added from the
			// admin console (POST /admins), nobody signs up as one.
			if (!admin) throw new ForbiddenException(NOT_STAFF);
			return this.loginAdmin(admin, supabaseUser.email);
		}
		if (admin) throw new ForbiddenException(STAFF_ONLY);

		// 2. Find or create user in local database (using Prisma).
		// Looked up by Supabase's own stable UUID, not email — email can
		// change (e.g. via a "change email" flow), but the UUID never does.
		// Looking up by email would fail to find the existing user after an
		// email change and then crash trying to create a duplicate with the
		// same id (unique constraint violation on the primary key).
		let user = await this.prisma.user.findUnique({
			where: { id: supabaseUser.id },
		});

		if (!user) {
			user = await this.findOrphanedAccount(supabaseUser.id, supabaseUser.email)
				?? await this.createUser(supabaseUser.id, supabaseUser.email);
		} else if (user.email !== supabaseUser.email) {
			// Keep our local copy in sync if it ever drifts — e.g. after a
			// confirmed email change in Supabase.
			user = await this.prisma.user.update({
				where: { id: user.id },
				data: { email: supabaseUser.email },
			});
		}

		if (user.suspended) {
			throw new ForbiddenException('Your account has been suspended.');
		}

		// 3. If this user has 2FA enabled, don't issue the real JWT yet — hand
		// back a short-lived challenge token the frontend must exchange for a
		// real session via /auth/2fa/login-verify.
		if (user.twoFactorEnabled) {
			return this.mfaChallenge(user.id);
		}
		return this.issueSession(user);
	}

	private async loginAdmin(admin: { id: string; email: string; twoFactorEnabled: boolean }, email?: string) {
		if (email && admin.email !== email) {
			// Same as for users: follow a confirmed email change in Supabase.
			await this.prisma.admin.update({ where: { id: admin.id }, data: { email } });
		}
		if (admin.twoFactorEnabled) {
			return this.mfaChallenge(admin.id, true);
		}
		// An admin without MFA gets a session that only reaches MFA setup
		// (JwtStrategy); this tells the frontend to send them there first.
		return { ...(await this.issueAdminSession({ id: admin.id, email: email ?? admin.email })), twoFactorSetupRequired: true };
	}

	// `admin` tells /auth/2fa/login-verify which table the account is in.
	private async mfaChallenge(id: string, admin = false) {
		const challengeToken = await this.jwt.signAsync(
			{ sub: id, purpose: 'mfa', ...(admin && { admin: true }) },
			{ expiresIn: '5m' },
		);
		return { twoFactorRequired: true, challengeToken };
	}

	// How the Supabase session was made: its access token lists the sign-in
	// methods in `amr` ("password", "oauth", ...). Only read after getUser()
	// above has checked the token, so the payload can be trusted.
	private signedInWithPassword(accessToken: string): boolean {
		try {
			const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString());
			return Array.isArray(payload.amr) && payload.amr.some((a: any) => a?.method === 'password');
		} catch {
			return false;
		}
	}

	// Same email, different Supabase id: the person's Supabase login was deleted
	// and they signed up again, so Supabase gave them a new id while our row still
	// has the old one. Creating a second row would crash on the unique email.
	// Move the old account over to the new id, but only when the old login is
	// really gone (otherwise it's a different, live account: refuse clearly).
	// Signing up needs a confirmed email, so this is the same person.
	private async findOrphanedAccount(newId: string, email: string) {
		const old = await this.prisma.user.findUnique({ where: { email } });
		if (!old) return null;

		const { data, error } = await this.supabase.auth.admin.getUserById(old.id);
		if (data?.user) {
			throw new ConflictException('An account with this email already exists. Log in with it instead.');
		}
		if (error && error.status !== 404) {
			throw new ServiceUnavailableException('Could not check your account right now. Please try again.');
		}

		// profiles.userId is a plain column (no foreign key), so it's moved by hand;
		// recovery codes, friendships and invitations follow via ON UPDATE CASCADE.
		return this.prisma.$transaction(async (tx) => {
			await tx.profile.updateMany({ where: { userId: old.id }, data: { userId: newId } });
			return tx.user.update({ where: { id: old.id }, data: { id: newId } });
		});
	}

	// The username is the part of the email before the @. Two different emails
	// can share it (hello@a.com, hello@b.com), and usernames are unique, so on a
	// clash add a short random suffix instead of failing the signup.
	private async createUser(id: string, email: string) {
		const base = email.split('@')[0] || 'user';
		for (let attempt = 0; attempt < 5; attempt++) {
			const username = attempt === 0 ? base : `${base}-${randomBytes(2).toString('hex')}`;
			try {
				return await this.prisma.user.create({
					data: {
						id, // use the Supabase UUID
						email,
						username,
						profile: {
							create: {
								firstName: '',
								userId: id,
							}
						}
					},
				});
			} catch (e: any) {
				const usernameTaken = e?.code === 'P2002' && String(e?.meta?.target ?? e?.message).includes('username');
				if (!usernameTaken) throw e;
			}
		}
		throw new ServiceUnavailableException('Could not create your account right now. Please try again.');
	}

	// Admins have no profile; their sessions carry role ADMIN, which is how
	// JwtStrategy knows to look in the Admin table.
	issueAdminSession(admin: { id: string; email: string }) {
		return this.issueSession({ ...admin, profileId: null, role: 'ADMIN' });
	}

	async issueSession(user: { id: string; email: string; profileId: number | null; role: string }) {
		const token = await this.jwt.signAsync({
			sub: user.id,
			email: user.email,
			profileId: user.profileId,
			role: user.role,
		});

		return {
			accessToken: token,
			user: { id: user.id, email: user.email, profileId: user.profileId, role: user.role },
		};
	}
	// --- Guest accounts ("Try as guest" on the front page) ----------------
	// Every visit gets its own throwaway account (site role GUEST) with its own
	// copy of the demo tree below, so no visitor ever sees another's edits. No
	// Supabase login: the things that would need one (password, email, MFA,
	// deleting the account) are refused for guests anyway (NotGuestGuard).
	// Guest accounts are removed a day later, on a later guest login.
	// guest@example.com, the old shared guest account, is kept as the on/off
	// switch: suspend it in the admin panel to turn guest access off.
	private static readonly GUEST_SWITCH_EMAIL = 'guest@example.com';
	private static readonly GUEST_TREE = 'Guest Demo Family';
	// A guest (account and demo tree) is removed after 15 minutes without a
	// request. JwtStrategy keeps User.updatedAt as the guest's last activity.
	private static readonly GUEST_IDLE_MS = 15 * 60 * 1000;
	private guestSweep?: ReturnType<typeof setInterval>;

	// Checked every minute, so an idle guest goes within about 16 minutes.
	onModuleInit() {
		this.guestSweep = setInterval(() => {
			this.removeOldGuests().catch((e) => this.logger.warn(`Guest cleanup failed: ${e?.message}`));
		}, 60 * 1000);
	}

	onModuleDestroy() {
		if (this.guestSweep) clearInterval(this.guestSweep);
	}
	// No throttle on this route, and each visit makes an account and a tree.
	private static readonly GUESTS_PER_HOUR = 3;

	async loginAsGuest() {
		const sw = await this.prisma.user.findUnique({ where: { email: AuthService.GUEST_SWITCH_EMAIL }, select: { suspended: true } });
		if (sw?.suspended) {
			throw new ForbiddenException('Guest access is turned off right now. Please sign up instead.');
		}
		await this.removeOldGuests().catch((e) => this.logger.warn(`Guest cleanup failed: ${e?.message}`));
		const lastHour = await this.prisma.user.count({
			where: { role: 'GUEST', email: { not: AuthService.GUEST_SWITCH_EMAIL }, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
		});
		if (lastHour >= AuthService.GUESTS_PER_HOUR) {
			throw new ServiceUnavailableException('Too many guests right now. Please try again later, or sign up.');
		}

		const id = randomUUID();
		const tag = randomBytes(4).toString('hex');
		const user = await this.prisma.user.create({
			data: {
				id,
				email: `guest-${tag}@example.com`, // example.com never gets mail
				username: `guest-${tag}`,
				role: 'GUEST',
				profile: { create: { firstName: 'Guest', userId: id } },
			},
		});
		const slug = await this.buildGuestTree(user.profileId!, tag);
		return { ...(await this.issueSession(user)), slug };
	}

	// Guest accounts idle for GUEST_IDLE_MS, with their trees (and the trees the
	// old shared guest account still owns). Runs every minute and on each guest
	// login; a few at a time keeps each run quick.
	private async removeOldGuests() {
		const sw = await this.prisma.user.findUnique({ where: { email: AuthService.GUEST_SWITCH_EMAIL }, select: { profileId: true } });
		if (sw?.profileId) {
			for (const t of await this.prisma.tree.findMany({ where: { ownerId: sw.profileId }, select: { id: true } })) {
				await this.trees.deleteTree(t.id, sw.profileId);
			}
		}
		const old = await this.prisma.user.findMany({
			where: {
				role: 'GUEST',
				email: { not: AuthService.GUEST_SWITCH_EMAIL },
				updatedAt: { lt: new Date(Date.now() - AuthService.GUEST_IDLE_MS) },
			},
			select: { id: true, profileId: true },
			take: 20,
		});
		for (const guest of old) {
			await this.removeGuest(guest.id, guest.profileId);
		}
	}

	// Like deleteOwnAccount, minus what a guest can't have (photos, joined
	// trees, a Supabase login).
	private async removeGuest(userId: string, profileId: number | null) {
		if (profileId) {
			for (const t of await this.prisma.tree.findMany({ where: { ownerId: profileId }, select: { id: true } })) {
				await this.trees.deleteTree(t.id, profileId);
			}
		}
		await this.prisma.$transaction(async (tx) => {
			await tx.invitation.deleteMany({ where: { inviterId: userId } });
			await tx.user.delete({ where: { id: userId } }); // cascades friendships
			if (profileId) {
				await tx.treeMember.deleteMany({ where: { profileId } });
				await tx.auditLog.deleteMany({ where: { profileId } });
				await tx.profile.updateMany({ where: { motherId: profileId }, data: { motherId: null } });
				await tx.profile.updateMany({ where: { fatherId: profileId }, data: { fatherId: null } });
				await tx.profile.updateMany({ where: { spouseId: profileId }, data: { spouseId: null } });
				await tx.profile.delete({ where: { id: profileId } }); // events cascade
			}
		});
	}

	// This visitor's own copy of the demo tree (the template below). Tree names
	// are unique, so each copy carries the guest's tag.
	private async buildGuestTree(profileId: number, tag: string): Promise<string> {
		const name = `${AuthService.GUEST_TREE} ${tag}`;
		const tree = await this.trees.createTree(profileId, name, 'A sample family to try things out. It is yours alone, and is removed a day after your visit.');
		if (!tree) throw new ServiceUnavailableException('Could not set up the demo tree. Please try again.');
		const treeId = tree.id;
		// No join code: nobody else joins a guest's tree, and the banner shows none.
		await this.prisma.tree.update({ where: { id: treeId }, data: { code: null } });

		const person = (id: number, firstName: string, lastName: string, gender: string, born: string, bio?: string) =>
			this.prisma.profile.update({ where: { id }, data: { firstName, lastName, gender, birthDate: new Date(born), bio } });
		const addSpouse = async (id: number) => {
			await this.trees.addSpouseNode(treeId, profileId, id);
			return (await this.prisma.profile.findUniqueOrThrow({ where: { id } })).spouseId!;
		};
		const addChild = async (id: number) => {
			await this.trees.addChildNode(treeId, profileId, id);
			const child = await this.prisma.profile.findFirstOrThrow({
				where: { OR: [{ fatherId: id }, { motherId: id }] },
				orderBy: { id: 'desc' },
			});
			return child.id;
		};

		// Three generations. Genders are set before adding children, since
		// addChildNode uses them to pick the mother and father slots.
		const robert = tree.root.profile!.id;
		await person(robert, 'Robert', 'Tan', 'MALE', '1948-03-12', 'Retired teacher from Penang.');
		await person(await addSpouse(robert), 'Mary', 'Tan', 'FEMALE', '1951-07-02', 'Loves gardening and cooking for the whole family.');
		const david = await addChild(robert);
		await person(david, 'David', 'Tan', 'MALE', '1975-11-20', 'Engineer in Kuala Lumpur.');
		const susan = await addChild(robert);
		await person(susan, 'Susan', 'Tan', 'FEMALE', '1979-04-08');
		await person(await addSpouse(david), 'Grace', 'Lee', 'FEMALE', '1977-01-15');
		await person(await addChild(david), 'Emily', 'Tan', 'FEMALE', '2005-06-30');
		await person(await addChild(david), 'Jason', 'Tan', 'MALE', '2008-09-14');

		return tree.slug;
	}

	// --- Account changes (email, password) -------------------------------
	// The browser drops its Supabase session right after login (see the
	// frontend's exchangeSupabaseToken), so these routes are the only way to
	// change the email or password, and each one checks the current password
	// here on the server. A stolen app token alone can't move the account to
	// someone else's inbox.

	private static readonly MIN_PASSWORD_LENGTH = 8; // matches minimum_password_length in supabase/config.toml

	// A short-lived client for acting as one user. Never the shared
	// this.supabase: signing in on that would leave a user's session on an
	// instance every request shares.
	private userScopedClient(): SupabaseClient {
		return createClient(
			this.config.get<string>('SUPABASE_AUTH_URL')!,
			this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
			{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
		);
	}

	async getAccount(userId: string) {
		const { data, error } = await this.supabase.auth.admin.getUserById(userId);
		if (error || !data.user) {
			throw new NotFoundException('Account not found');
		}
		const user = data.user;
		const hasGoogle = !!user.identities?.some((i) => i.provider === 'google');
		return {
			email: user.email ?? null,
			pendingEmail: user.new_email ?? null,
			hasPassword: await this.hasPassword(userId, user),
			// Signs in with Google too. If they change the email, they should
			// expect to sign in with email + password from then on.
			hasGoogle,
		};
	}

	// Whether the account can sign in with a password. How it signed up isn't
	// enough: a Google account that later set a password via the reset link
	// still only lists a 'google' identity. Supabase's own auth.users row is the
	// source of truth (only whether a hash exists is read, never the hash).
	private async hasPassword(userId: string, user: { identities?: { provider: string }[] }): Promise<boolean> {
		try {
			const rows = await this.prisma.$queryRaw<{ has: boolean }[]>`
				SELECT (encrypted_password IS NOT NULL AND encrypted_password <> '') AS has
				FROM auth.users WHERE id = ${userId}::uuid`;
			if (rows.length) return rows[0].has;
		} catch (err) {
			// e.g. a local DB without the auth schema: fall back to the sign-up method.
		}
		return !!user.identities?.some((i) => i.provider === 'email');
	}

	private async signInAsUser(userId: string, currentPassword: string) {
		if (!currentPassword) {
			throw new BadRequestException('Current password is required');
		}
		const account = await this.getAccount(userId);
		if (!account.hasPassword || !account.email) {
			throw new BadRequestException('This account has no password yet. Use "Set a password" in Settings first.');
		}
		const client = this.userScopedClient();
		const { error } = await client.auth.signInWithPassword({ email: account.email, password: currentPassword });
		if (error) {
			// 400, not 401: the frontend treats a 401 as "your app session
			// expired" and logs the user out.
			throw new BadRequestException('Current password is incorrect');
		}
		return { client, email: account.email };
	}

	async changeEmail(userId: string, currentPassword: string, newEmail: string) {
		const email = (newEmail ?? '').trim().toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			throw new BadRequestException('Enter a valid email address');
		}
		const { client, email: currentEmail } = await this.signInAsUser(userId, currentPassword);
		try {
			if (email === currentEmail.toLowerCase()) {
				throw new BadRequestException('That is already your email address');
			}
			// Supabase emails a confirmation link to the new address; the switch
			// happens once it's clicked ("Secure email change" is off in
			// production, so the old address isn't asked). loginWithSupabaseToken
			// picks up the new address on the next login.
			const origin = this.config.get<string>('CORS_ORIGIN') ?? '';
			const { error } = await client.auth.updateUser({ email }, { emailRedirectTo: `${origin}/login` });
			if (error) {
				throw new BadRequestException(error.message);
			}
			return { sentTo: email };
		} finally {
			await client.auth.signOut({ scope: 'local' });
		}
	}

	async changePassword(userId: string, currentPassword: string, newPassword: string) {
		if (!newPassword || newPassword.length < AuthService.MIN_PASSWORD_LENGTH) {
			throw new BadRequestException(`New password must be at least ${AuthService.MIN_PASSWORD_LENGTH} characters`);
		}
		if (newPassword === currentPassword) {
			throw new BadRequestException('New password must be different from the current one');
		}
		const { client } = await this.signInAsUser(userId, currentPassword);
		// current_password too: the production Supabase project requires it.
		const { error } = await client.auth.updateUser({ password: newPassword, current_password: currentPassword });
		if (error) {
			await client.auth.signOut({ scope: 'local' });
			throw new BadRequestException(error.message);
		}
		// Ends every Supabase session for this account, e.g. an unused
		// password-reset session. App JWTs are stateless and run until expiry.
		await client.auth.signOut({ scope: 'global' });
		return { ok: true };
	}

	// --- Deleting your own account ----------------------------------------
	// What goes: the login, the user row, friendships, 2FA codes, invitations
	// sent, every tree they own (with its made-up people) and their photos.
	// Trees they only joined are left like "Leave tree" does it, so a node they
	// claimed shows its made-up person again. Their profile is deleted, or, if
	// another tree's history still points at it, kept as an empty "Deleted
	// user" so the log stays readable without their details.
	async deleteOwnAccount(userId: string, currentPassword?: string, confirm?: string) {
		if (confirm !== 'DELETE') {
			throw new BadRequestException('Type DELETE to confirm');
		}
		// Admin accounts can't delete themselves either: a site with no admin
		// left has nobody to manage it. Another admin removes them (DELETE /admins/:id).
		if (await this.prisma.admin.findUnique({ where: { id: userId } })) {
			throw new ForbiddenException('Site admins cannot delete their own account. Ask another admin to remove it.');
		}
		const user = await this.prisma.user.findUnique({ where: { id: userId } });
		if (!user) {
			throw new NotFoundException('Account not found');
		}
		// Accounts with a password prove it's them; Google-only accounts have
		// nothing to check beyond the typed confirmation.
		const account = await this.getAccount(userId);
		if (account.hasPassword) {
			const { client } = await this.signInAsUser(userId, currentPassword ?? '');
			await client.auth.signOut({ scope: 'local' });
		}

		const profileId = user.profileId;
		let deletedTrees = 0;
		if (profileId) {
			// Own trees first, through the normal tree delete, which also removes
			// their made-up people. Their own profile still has its userId here,
			// so that delete never takes it along.
			const owned = await this.prisma.tree.findMany({ where: { ownerId: profileId }, select: { id: true } });
			for (const t of owned) {
				await this.trees.deleteTree(t.id, profileId);
				deletedTrees++;
			}
		}

		const profile = profileId
			? await this.prisma.profile.findUnique({ where: { id: profileId }, select: { photoUrl: true, firstName: true } })
			: null;
		const photoUrl = profile?.photoUrl;

		await this.prisma.$transaction(async (tx) => {
			if (profileId) {
				const memberships = await tx.treeMember.findMany({ where: { profileId } });
				for (const m of memberships) {
					// Same as leaveTree: unlink the node they claimed.
					await tx.treeMember.updateMany({ where: { linkId: m.id }, data: { linkId: null, claim: 'EMPTY' } });
					await tx.treeMember.delete({ where: { id: m.id } });
					if (m.treeId) {
						await tx.auditLog.create({
							data: { treeId: m.treeId, profileId, action: 'LEAVE_TREE', details: 'Deleted their account' },
						});
					}
				}
			}
			await tx.invitation.deleteMany({ where: { inviterId: userId } });
			// Cascades friendships and recovery codes.
			await tx.user.delete({ where: { id: userId } });

			if (profileId) {
				// Nobody's parent or spouse any more.
				await tx.profile.updateMany({ where: { motherId: profileId }, data: { motherId: null } });
				await tx.profile.updateMany({ where: { fatherId: profileId }, data: { fatherId: null } });
				await tx.profile.updateMany({ where: { spouseId: profileId }, data: { spouseId: null } });
				const logged = await tx.auditLog.count({ where: { profileId } });
				if (logged === 0) {
					await tx.profile.delete({ where: { id: profileId } }); // events cascade
				} else {
					await tx.event.deleteMany({ where: { profileId } });
					await tx.profile.update({
						where: { id: profileId },
						data: {
							firstName: 'Deleted user', lastName: null, gender: null, birthDate: null, deathDate: null,
							bio: null, photoUrl: null, verified: false, userId: null,
							motherId: null, fatherId: null, spouseId: null,
						},
					});
				}
			}
		});

		// Photos live under avatars/<profileId>/. Best effort: the account is
		// already gone, a leftover file only takes space.
		if (profileId) {
			const { data: files } = await this.supabase.storage.from('avatars').list(String(profileId));
			const paths = (files ?? []).map((f) => `${profileId}/${f.name}`);
			const current = photoUrl?.split('/avatars/')[1];
			if (current && !paths.includes(current)) paths.push(current);
			if (paths.length) {
				const { error } = await this.supabase.storage.from('avatars').remove(paths);
				if (error) this.logger.warn(`Account ${userId} deleted but its photos were not removed: ${error.message}`);
			}
		}

		// Last, so a Supabase hiccup can't leave a user row nobody can log in
		// to. If it fails, signing in again would make a fresh empty account.
		const { error } = await this.supabase.auth.admin.deleteUser(userId);
		if (error) {
			this.logger.warn(`Account ${userId} deleted but its Supabase login was not removed: ${error.message}`);
		}
		this.logger.log(`Account ${userId} deleted by its owner; ${deletedTrees} owned trees removed`);

		// Goodbye note, read from the row loaded before the delete. Quietly: the
		// account is gone whether or not the mail goes out.
		const site = (this.config.get<string>('CORS_ORIGIN') || '').split(',')[0].trim();
		void this.mail.sendQuietly({
			to: user.email,
			subject: 'Your My Simple Family Tree account has been deleted',
			text: [
				`Hi ${profile?.firstName || user.username},`,
				'',
				'Your account on My Simple Family Tree has been deleted, as you asked. We\'re sad to see you go.',
				`When: ${malaysiaTime()}`,
				'',
				deletedTrees
					? `Your login, profile, photos and friends list are gone, along with the ${deletedTrees === 1 ? 'family tree' : `${deletedTrees} family trees`} you owned.`
					: 'Your login, profile, photos and friends list are gone.',
				'You can sign up again with this email at any time; you\'ll start with a fresh, empty account.',
				...(site ? ['', site] : []),
				'',
				'If you didn\'t do this, someone had your password: sign up again and contact us through the feedback page.',
			].join('\n'),
		}, 'Account deletion');
		return { message: 'Account deleted.', deletedTrees };
	}
}
