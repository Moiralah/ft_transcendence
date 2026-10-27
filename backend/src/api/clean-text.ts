import { ValidateBy, ValidationOptions } from 'class-validator';
import { DataSet, RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

// Family trees are shared with relatives, so rude words are refused. The
// transformers also catch spellings like "sh1t" and "fuuuck".

// Descriptions and bios: obscenity's full English list.
const strict = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

// People's names and tree names: only the worst swears and slurs, so real
// surnames (Dick, Cockburn, Hancock, Wank...) and "The Dick family" go
// through. Each word must be an originalWord from obscenity's English list
// (dist/preset/english.js).
const NAME_WORDS = [
	'fuck', 'shit', 'cunt', 'whore', 'slut',
	'nigger', 'kike', 'chink', 'chingchong', 'fag', 'tranny', 'africoon', 'arabush', 'abeed', 'boonga',
];
const names = new RegExpMatcher({
	...new DataSet<{ originalWord: string }>()
		.addAll(englishDataset)
		.removePhrasesIf((p) => !NAME_WORDS.includes(p.metadata!.originalWord))
		.build(),
	...englishRecommendedTransformers,
});

// A match only counts when it is a whole word: "Shit" is refused, but
// Cummings, Fagan, Slutsky and Shitole are real surnames and go through.
// (So does "fuckface": the price of not blocking people's names.)
const isLetter = (c: string | undefined) => c !== undefined && /\p{L}/u.test(c);
const wholeWord = (matcher: RegExpMatcher) => (value: string) =>
	matcher.getAllMatches(value).some((m) => !isLetter(value[m.startIndex - 1]) && !isLetter(value[m.endIndex + 1]));

// The field names as users see them on the page.
const LABELS: Record<string, string> = {
	name: 'Tree name',
	description: 'Description',
	firstName: 'First name',
	lastName: 'Last name',
	bio: 'Bio',
};

function cleanCheck(hasBadWord: (value: string) => boolean, name: string, options?: ValidationOptions) {
	return ValidateBy(
		{
			name,
			validator: {
				// Non-strings pass: @IsString and @IsOptional deal with those.
				validate: (value: unknown) => typeof value !== 'string' || !hasBadWord(value),
				defaultMessage: ({ property }) =>
					`${LABELS[property] ?? property} contains a word that isn't allowed. Please keep it family-friendly.`,
			},
		},
		options,
	);
}

export const IsClean = (options?: ValidationOptions) => cleanCheck(wholeWord(strict), 'isClean', options);
export const IsCleanName = (options?: ValidationOptions) => cleanCheck(wholeWord(names), 'isCleanName', options);
