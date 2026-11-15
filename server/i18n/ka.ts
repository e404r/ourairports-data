export type Lang = 'ka' | 'en';

export const AIRPORT_TYPE_LABELS: Record<string, { en: string; ka: string }> = {
  large_airport: { en: 'Large Airport', ka: 'დიდი აეროპორტი' },
  medium_airport: { en: 'Medium Airport', ka: 'საშუალო აეროპორტი' },
  small_airport: { en: 'Small Airport', ka: 'მცირე აეროპორტი' },
  heliport: { en: 'Heliport', ka: 'ვერტოდრომი' },
  seaplane_base: { en: 'Seaplane Base', ka: 'ჰიდროაეროდრომი' },
  balloonport: { en: 'Balloonport', ka: 'აეროსტატის სადგური' },
  closed: { en: 'Closed', ka: 'დახურული' },
};

const COUNTRY_OVERRIDES_KA: Record<string, string> = {
  XK: 'კოსოვო',
  US: 'აშშ',
  GB: 'გაერთიანებული სამეფო',
  AE: 'არაბთა გაერთიანებული საამიროები',
  GE: 'საქართველო',
  TR: 'თურქეთი',
  KZ: 'ყაზახეთი',
  FR: 'საფრანგეთი',
  DE: 'გერმანია',
  CH: 'შვეიცარია',
  IT: 'იტალია',
  ES: 'ესპანეთი',
  GR: 'საბერძნეთი',
  QA: 'კატარი',
  SA: 'საუდის არაბეთი',
  AZ: 'აზერბაიჯანი',
  AM: 'სომხეთი',
};

const regionNamesKa = new Intl.DisplayNames(['ka'], { type: 'region' });

export function getCountryNameKa(iso2: string, fallbackEn: string): string {
  const code = iso2.trim().toUpperCase();
  if (COUNTRY_OVERRIDES_KA[code]) {
    return COUNTRY_OVERRIDES_KA[code];
  }
  if (/^[A-Z]{2}$/.test(code)) {
    try {
      const translated = regionNamesKa.of(code);
      if (translated && translated !== code) {
        return translated;
      }
    } catch {
      // Fallback to English name if region code is non-standard
    }
  }
  return fallbackEn;
}

export const KNOWN_AIRPORT_KA: Record<
  string,
  { name_ka: string; city_ka?: string }
> = {
  // Georgia
  UGTB: { name_ka: 'თბილისის შოთა რუსთაველის საერთაშორისო აეროპორტი', city_ka: 'თბილისი' },
  UGSB: { name_ka: 'ბათუმის ალექსანდრე ქართველის საერთაშორისო აეროპორტი', city_ka: 'ბათუმი' },
  UGKO: { name_ka: 'ქუთაისის დავით აღმაშენებლის საერთაშორისო აეროპორტი', city_ka: 'ქუთაისი' },
  UGMS: { name_ka: 'მესტიის თამარ მეფის აეროპორტი', city_ka: 'მესტია' },
  UGAM: { name_ka: 'ამბროლაურის აეროპორტი', city_ka: 'ამბროლაური' },
  UG54: { name_ka: 'ნატახტარის აეროდრომი', city_ka: 'ნატახტარი' },
  // Key Regional & International Hubs
  LTFM: { name_ka: 'სტამბოლის საერთაშორისო აეროპორტი', city_ka: 'სტამბოლი' },
  LTFJ: { name_ka: 'სტამბოლის საბიჰა გიოქჩენის აეროპორტი', city_ka: 'სტამბოლი' },
  LTAC: { name_ka: 'ანკარის ესენბოღას აეროპორტი', city_ka: 'ანკარა' },
  LTAI: { name_ka: 'ანტალიის აეროპორტი', city_ka: 'ანტალია' },
  OMDB: { name_ka: 'დუბაის საერთაშორისო აეროპორტი', city_ka: 'დუბაი' },
  OMDW: { name_ka: 'დუბაის ალ-მაქთუმის აეროპორტი', city_ka: 'დუბაი' },
  OMAA: { name_ka: 'აბუ-დაბის საერთაშორისო აეროპორტი', city_ka: 'აბუ-დაბი' },
  OTHH: { name_ka: 'დოჰას ჰამადის საერთაშორისო აეროპორტი', city_ka: 'დოჰა' },
  UAAA: { name_ka: 'ალმათის საერთაშორისო აეროპორტი', city_ka: 'ალმათი' },
  UACC: { name_ka: 'ასტანის ნურსულთან ნაზარბაევის აეროპორტი', city_ka: 'ასტანა' },
  UBBB: { name_ka: 'ბაქოს ჰეიდარ ალიევის საერთაშორისო აეროპორტი', city_ka: 'ბაქო' },
  UDYZ: { name_ka: 'ერევნის ზვართნოცის საერთაშორისო აეროპორტი', city_ka: 'ერევანი' },
  LFMN: { name_ka: 'ნიცის ლაჟვარდოვანი ნაპირის აეროპორტი', city_ka: 'ნიცა' },
  LFPB: { name_ka: 'პარიზის ლე-ბურჟეს ბიზნეს-ავიაციის აეროპორტი', city_ka: 'პარიზი' },
  LFPG: { name_ka: 'პარიზის შარლ დე გოლის აეროპორტი', city_ka: 'პარიზი' },
  LSGG: { name_ka: 'ჟენევის საერთაშორისო აეროპორტი', city_ka: 'ჟენევა' },
  LSZH: { name_ka: 'ციურიხის აეროპორტი', city_ka: 'ციურიხი' },
  EGLL: { name_ka: 'ლონდონის ჰითროუს აეროპორტი', city_ka: 'ლონდონი' },
  EGLF: { name_ka: 'ფარნბოროს ბიზნეს-აეროპორტი', city_ka: 'ფარნბორო' },
  EDDM: { name_ka: 'მიუნხენის აეროპორტი', city_ka: 'მიუნხენი' },
  EDDF: { name_ka: 'ფრანკფურტის აეროპორტი', city_ka: 'ფრანკფურტი' },
  LOWW: { name_ka: 'ვენის საერთაშორისო აეროპორტი', city_ka: 'ვენა' },
  LGAV: { name_ka: 'ათენის საერთაშორისო აეროპორტი', city_ka: 'ათენი' },
  LIRF: { name_ka: 'რომის ფიუმიჩინოს აეროპორტი', city_ka: 'რომი' },
  LIMC: { name_ka: 'მილანის მალპენსას აეროპორტი', city_ka: 'მილანი' },
  KJFK: { name_ka: 'ნიუ-იორკის ჯონ კენედის აეროპორტი', city_ka: 'ნიუ-იორკი' },
  KTEB: { name_ka: 'ტეტერბოროს ბიზნეს-აეროპორტი', city_ka: 'ტეტერბორო' },
};

export function getTypeLabel(type: string, lang: Lang): string {
  const entry = AIRPORT_TYPE_LABELS[type];
  if (!entry) return type;
  return lang === 'ka' ? entry.ka : entry.en;
}

export function getApiMessage(
  key: 'unauthorized' | 'rate_limited' | 'not_found' | 'bad_request' | 'sync_in_progress' | 'sync_success',
  lang: Lang
): string {
  const messages: Record<typeof key, { en: string; ka: string }> = {
    unauthorized: {
      en: 'Unauthorized: Valid API key is required.',
      ka: 'წვდომა აკრძალულია: საჭიროა ვალიდური API გასაღები.',
    },
    rate_limited: {
      en: 'Too many requests. Please slow down.',
      ka: 'ძალიან ბევრი მოთხოვნაა. გთხოვთ სცადოთ მოგვიანებით.',
    },
    not_found: {
      en: 'Airport not found.',
      ka: 'აეროპორტი ვერ მოიძებნა.',
    },
    bad_request: {
      en: 'Invalid query parameters.',
      ka: 'არასწორი მოთხოვნის პარამეტრები.',
    },
    sync_in_progress: {
      en: 'Upstream synchronization is already in progress.',
      ka: 'მონაცემების სინქრონიზაცია უკვე მიმდინარეობს.',
    },
    sync_success: {
      en: 'Upstream airport database synchronized successfully.',
      ka: 'აეროპორტების ბაზა წარმატებით განახლდა.',
    },
  };
  return lang === 'ka' ? messages[key].ka : messages[key].en;
}
