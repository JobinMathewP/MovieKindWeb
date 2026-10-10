export const PRESET_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "ml", name: "Malayalam" },
  { code: "ta", name: "Tamil" },
  { code: "ko", name: "Korean" },
] as const;

export function languageName(code: string): string {
  const preset = PRESET_LANGUAGES.find((language) => language.code === code);
  return preset?.name ?? code.toUpperCase();
}
