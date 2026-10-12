import { intlLocale } from '../../i18n/locale';

/** ISO 3166-1 alpha-2 country codes (every assigned one; same list as the backend). */
export const COUNTRY_CODES: readonly string[] = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ ' +
  'BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ ' +
  'DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY ' +
  'HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY ' +
  'MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
  'NA NC NE NF NG NI NL NO NP NR NU NZ OM ' +
  'PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ ' +
  'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ ' +
  'VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

export function isCountryCode(value: unknown): value is string {
  return typeof value === 'string' && COUNTRY_CODES.includes(value);
}

/** "Argentina" / "Australia" in the current language (the code if unknown). */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([intlLocale()], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const optionsByLocale = new Map<string, [string, string][]>();

/** Every country as [code, name], sorted by name in the current language (cached). */
export function countryOptions(): [string, string][] {
  const locale = intlLocale();
  let options = optionsByLocale.get(locale);
  if (!options) {
    options = COUNTRY_CODES.map((code): [string, string] => [code, countryName(code)]).sort(
      (a, b) => a[1].localeCompare(b[1], locale),
    );
    optionsByLocale.set(locale, options);
  }
  return options;
}

/**
 * The first country found in the browser's language preferences ("en-AU" →
 * "AU"); null when they don't say one (e.g. just "es").
 */
export function browserCountry(
  languages: readonly string[] = navigator.languages ?? [],
): string | null {
  for (const tag of languages) {
    try {
      const region = new Intl.Locale(tag).region;
      if (isCountryCode(region)) {
        return region;
      }
    } catch {
      // Malformed tag: try the next one.
    }
  }
  return null;
}
