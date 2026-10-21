import { ValidateBy, ValidationOptions } from 'class-validator';

// Birth dates: no future dates, and nothing older than year 1000
// (family trees can go back a long way). Without this, a date input
// happily accepts 9999-12-31.
export const MIN_PROFILE_DATE = '1000-01-01';

// Latest date allowed, as YYYY-MM-DD. One day of slack past today (UTC) so a
// user ahead of UTC (e.g. UTC+8) can still enter their own "today".
export function maxProfileDate(): string {
	return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isProfileDateInRange(value: string): boolean {
	const day = value.slice(0, 10);
	return day >= MIN_PROFILE_DATE && day <= maxProfileDate();
}

export function IsProfileDate(options?: ValidationOptions) {
	return ValidateBy(
		{
			name: 'isProfileDate',
			validator: {
				validate: (value: unknown) => typeof value === 'string' && isProfileDateInRange(value),
				defaultMessage: ({ property }) => `${property} must be between ${MIN_PROFILE_DATE} and today`,
			},
		},
		options,
	);
}
