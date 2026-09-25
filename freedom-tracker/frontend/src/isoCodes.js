// ISO 3166-1 numeric -> alpha-3 lookup for every country shape in world-atlas
// countries-110m.json. The topojson identifies countries by numeric code (geo.id)
// while the API returns alpha-3 codes, so the map joins through this table rather
// than by name — names differ between sources ('United States of America' vs
// 'United States', 'Dem. Rep. Congo' vs 'Democratic Republic of Congo', ...).
// N. Cyprus, Somaliland and Kosovo have no ISO numeric id in the atlas file.
export const ISO_NUMERIC_TO_ALPHA3 = {
  '004': 'AFG', // Afghanistan
  '008': 'ALB', // Albania
  '010': 'ATA', // Antarctica
  '012': 'DZA', // Algeria
  '024': 'AGO', // Angola
  '031': 'AZE', // Azerbaijan
  '032': 'ARG', // Argentina
  '036': 'AUS', // Australia
  '040': 'AUT', // Austria
  '044': 'BHS', // Bahamas
  '050': 'BGD', // Bangladesh
  '051': 'ARM', // Armenia
  '056': 'BEL', // Belgium
  '064': 'BTN', // Bhutan
  '068': 'BOL', // Bolivia
  '070': 'BIH', // Bosnia and Herz.
  '072': 'BWA', // Botswana
  '076': 'BRA', // Brazil
  '084': 'BLZ', // Belize
  '090': 'SLB', // Solomon Is.
  '096': 'BRN', // Brunei
  '100': 'BGR', // Bulgaria
  '104': 'MMR', // Myanmar
  '108': 'BDI', // Burundi
  '112': 'BLR', // Belarus
  '116': 'KHM', // Cambodia
  '120': 'CMR', // Cameroon
  '124': 'CAN', // Canada
  '140': 'CAF', // Central African Rep.
  '144': 'LKA', // Sri Lanka
  '148': 'TCD', // Chad
  '152': 'CHL', // Chile
  '156': 'CHN', // China
  '158': 'TWN', // Taiwan
  '170': 'COL', // Colombia
  '178': 'COG', // Congo
  '180': 'COD', // Dem. Rep. Congo
  '188': 'CRI', // Costa Rica
  '191': 'HRV', // Croatia
  '192': 'CUB', // Cuba
  '196': 'CYP', // Cyprus
  '203': 'CZE', // Czechia
  '204': 'BEN', // Benin
  '208': 'DNK', // Denmark
  '214': 'DOM', // Dominican Rep.
  '218': 'ECU', // Ecuador
  '222': 'SLV', // El Salvador
  '226': 'GNQ', // Eq. Guinea
  '231': 'ETH', // Ethiopia
  '232': 'ERI', // Eritrea
  '233': 'EST', // Estonia
  '238': 'FLK', // Falkland Is.
  '242': 'FJI', // Fiji
  '246': 'FIN', // Finland
  '250': 'FRA', // France
  '260': 'ATF', // Fr. S. Antarctic Lands
  '262': 'DJI', // Djibouti
  '266': 'GAB', // Gabon
  '268': 'GEO', // Georgia
  '270': 'GMB', // Gambia
  '275': 'PSE', // Palestine
  '276': 'DEU', // Germany
  '288': 'GHA', // Ghana
  '300': 'GRC', // Greece
  '304': 'GRL', // Greenland
  '320': 'GTM', // Guatemala
  '324': 'GIN', // Guinea
  '328': 'GUY', // Guyana
  '332': 'HTI', // Haiti
  '340': 'HND', // Honduras
  '348': 'HUN', // Hungary
  '352': 'ISL', // Iceland
  '356': 'IND', // India
  '360': 'IDN', // Indonesia
  '364': 'IRN', // Iran
  '368': 'IRQ', // Iraq
  '372': 'IRL', // Ireland
  '376': 'ISR', // Israel
  '380': 'ITA', // Italy
  '384': 'CIV', // Côte d'Ivoire
  '388': 'JAM', // Jamaica
  '392': 'JPN', // Japan
  '398': 'KAZ', // Kazakhstan
  '400': 'JOR', // Jordan
  '404': 'KEN', // Kenya
  '408': 'PRK', // North Korea
  '410': 'KOR', // South Korea
  '414': 'KWT', // Kuwait
  '417': 'KGZ', // Kyrgyzstan
  '418': 'LAO', // Laos
  '422': 'LBN', // Lebanon
  '426': 'LSO', // Lesotho
  '428': 'LVA', // Latvia
  '430': 'LBR', // Liberia
  '434': 'LBY', // Libya
  '440': 'LTU', // Lithuania
  '442': 'LUX', // Luxembourg
  '450': 'MDG', // Madagascar
  '454': 'MWI', // Malawi
  '458': 'MYS', // Malaysia
  '466': 'MLI', // Mali
  '478': 'MRT', // Mauritania
  '484': 'MEX', // Mexico
  '496': 'MNG', // Mongolia
  '498': 'MDA', // Moldova
  '499': 'MNE', // Montenegro
  '504': 'MAR', // Morocco
  '508': 'MOZ', // Mozambique
  '512': 'OMN', // Oman
  '516': 'NAM', // Namibia
  '524': 'NPL', // Nepal
  '528': 'NLD', // Netherlands
  '540': 'NCL', // New Caledonia
  '548': 'VUT', // Vanuatu
  '554': 'NZL', // New Zealand
  '558': 'NIC', // Nicaragua
  '562': 'NER', // Niger
  '566': 'NGA', // Nigeria
  '578': 'NOR', // Norway
  '586': 'PAK', // Pakistan
  '591': 'PAN', // Panama
  '598': 'PNG', // Papua New Guinea
  '600': 'PRY', // Paraguay
  '604': 'PER', // Peru
  '608': 'PHL', // Philippines
  '616': 'POL', // Poland
  '620': 'PRT', // Portugal
  '624': 'GNB', // Guinea-Bissau
  '626': 'TLS', // Timor-Leste
  '630': 'PRI', // Puerto Rico
  '634': 'QAT', // Qatar
  '642': 'ROU', // Romania
  '643': 'RUS', // Russia
  '646': 'RWA', // Rwanda
  '682': 'SAU', // Saudi Arabia
  '686': 'SEN', // Senegal
  '688': 'SRB', // Serbia
  '694': 'SLE', // Sierra Leone
  '703': 'SVK', // Slovakia
  '704': 'VNM', // Vietnam
  '705': 'SVN', // Slovenia
  '706': 'SOM', // Somalia
  '710': 'ZAF', // South Africa
  '716': 'ZWE', // Zimbabwe
  '724': 'ESP', // Spain
  '728': 'SSD', // S. Sudan
  '729': 'SDN', // Sudan
  '732': 'ESH', // W. Sahara
  '740': 'SUR', // Suriname
  '748': 'SWZ', // eSwatini
  '752': 'SWE', // Sweden
  '756': 'CHE', // Switzerland
  '760': 'SYR', // Syria
  '762': 'TJK', // Tajikistan
  '764': 'THA', // Thailand
  '768': 'TGO', // Togo
  '780': 'TTO', // Trinidad and Tobago
  '784': 'ARE', // United Arab Emirates
  '788': 'TUN', // Tunisia
  '792': 'TUR', // Turkey
  '795': 'TKM', // Turkmenistan
  '800': 'UGA', // Uganda
  '804': 'UKR', // Ukraine
  '807': 'MKD', // Macedonia
  '818': 'EGY', // Egypt
  '826': 'GBR', // United Kingdom
  '834': 'TZA', // Tanzania
  '840': 'USA', // United States of America
  '854': 'BFA', // Burkina Faso
  '858': 'URY', // Uruguay
  '860': 'UZB', // Uzbekistan
  '862': 'VEN', // Venezuela
  '887': 'YEM', // Yemen
  '894': 'ZMB', // Zambia
}
