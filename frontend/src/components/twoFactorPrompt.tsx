'use client';

import { useState } from 'react';
import { Button } from './button';
import { verifyTwoFactorLogin, storeSession, type LoginSuccess } from '@/lib/auth';

interface TwoFactorPromptProps {
	challengeToken: string;
	onVerified: (result: LoginSuccess) => void;
}

export function TwoFactorPrompt({ challengeToken, onVerified }: TwoFactorPromptProps) {
	const [code, setCode] = useState('');
	const [useRecoveryCode, setUseRecoveryCode] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			const result = await verifyTwoFactorLogin(challengeToken, code.trim());
			storeSession(result);
			onVerified(result);
		} catch (err: any) {
			setError(err.message || 'Invalid code');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="mb-3" aria-label="Two-factor verification">
			<p className="text-sm text-slate-700 mb-2">
				{useRecoveryCode
					? 'Enter one of your recovery codes.'
					: 'Enter the 6-digit code from your authenticator app.'}
			</p>
			<label htmlFor="twofactor-code" className="sr-only">
				{useRecoveryCode ? 'Recovery code' : 'Authentication code'}
			</label>
			<input
				id="twofactor-code"
				type="text"
				inputMode={useRecoveryCode ? 'text' : 'numeric'}
				autoComplete="one-time-code"
				placeholder={useRecoveryCode ? 'XXXXX-XXXXX' : '123456'}
				value={code}
				onChange={(e) => setCode(e.target.value)}
				required
			/>
			<button type="submit" disabled={submitting}>
				{submitting ? 'Verifying...' : 'Verify'}
			</button>
			{error && (
				<div className="error" role="alert">
					{error}
				</div>
			)}
			<div className="mt-2">
				<Button
					type="button"
					variant="ghost"
					// The ghost variant is a fixed w-24 (fine for "Search"), too narrow for this label.
					className="!w-full"
					onClick={() => {
						setUseRecoveryCode((v) => !v);
						setCode('');
						setError(null);
					}}
				>
					{useRecoveryCode ? 'Use authenticator code instead' : 'Use a recovery code instead'}
				</Button>
			</div>
		</form>
	);
}
