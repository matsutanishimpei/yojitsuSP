import type { CompanySearchResult } from '@my-app/shared';

type GBizResponse = { 'hojin-infos'?: Array<{ name?: string; corporate_number?: string }> };

const MOCK_COMPANIES: CompanySearchResult[] = [
  { name: 'キャロルシステム株式会社', number: '3011001006461' },
  { name: '株式会社共立ソリューションズ', number: '4010001066795' },
  { name: '株式会社アイエスエフネット', number: '5010401052220' },
  { name: '株式会社テクノプロ', number: '1010001140685' },
  { name: '日本システムウエア株式会社', number: '8011001003884' },
  { name: '伊藤忠テクノソリューションズ株式会社', number: '3010401050212' },
  { name: 'トランスコスモス株式会社', number: '3011101004696' },
  { name: '株式会社システナ', number: '8010401056581' },
  { name: 'ＳＣＳＫ株式会社', number: '6010001142995' },
  { name: '株式会社大塚商会', number: '1010001015694' },
  { name: '富士ソフト株式会社', number: '5020001026038' },
  { name: '株式会社エヌ・ティ・ティ・データ', number: '9010001046390' },
];

export async function searchCompanies(name: string, apiKey?: string): Promise<CompanySearchResult[]> {
  if (!name) return [];
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) headers['X-gbizinfo-key'] = apiKey;
    const response = await fetch(`https://info.gbiz.go.jp/hojin/v1/hojin?name=${encodeURIComponent(name)}&limit=10`, { headers });
    if (response.ok) {
      const data = await response.json() as GBizResponse;
      if (data['hojin-infos']) {
        return data['hojin-infos'].map((company) => ({ name: company.name || '', number: company.corporate_number || '' }));
      }
    }
  } catch (error) {
    console.warn('gBizINFO API fetch failed, falling back to mock search:', error);
  }
  const query = name.toLowerCase();
  return MOCK_COMPANIES.filter((company) =>
    company.name.toLowerCase().includes(query) || company.number.includes(query));
}
