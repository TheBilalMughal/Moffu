import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { supabase } from '@/lib/supabase';
import { googleService, type GoogleConnection, type GoogleLocation, type BusinessSearchResult } from '@/features/google/google.service';
import { Toast, useToast } from '@/components/Toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIMEZONES = Intl.supportedValuesOf('timeZone');

interface Country {
  code: string;
  dial: string;
  name: string;
  flag: string;
  pattern: RegExp;
  placeholder: string;
}

const COUNTRIES: Country[] = [
  // A
  { code: 'AF', dial: '+93',  name: 'Afghanistan',             flag: 'AF', pattern: /^\d{9}$/,      placeholder: '070 123 4567'   },
  { code: 'AL', dial: '+355', name: 'Albania',                 flag: 'AL', pattern: /^\d{9}$/,      placeholder: '069 123 4567'   },
  { code: 'DZ', dial: '+213', name: 'Algeria',                 flag: 'DZ', pattern: /^\d{9}$/,      placeholder: '0551 23 45 67'  },
  { code: 'AD', dial: '+376', name: 'Andorra',                 flag: 'AD', pattern: /^\d{6,9}$/,    placeholder: '312 345'        },
  { code: 'AO', dial: '+244', name: 'Angola',                  flag: 'AO', pattern: /^\d{9}$/,      placeholder: '923 456 789'    },
  { code: 'AG', dial: '+1',   name: 'Antigua and Barbuda',     flag: 'AG', pattern: /^\d{10}$/,     placeholder: '(268) 464-1234' },
  { code: 'AR', dial: '+54',  name: 'Argentina',               flag: 'AR', pattern: /^\d{10,11}$/,  placeholder: '011 1234-5678'  },
  { code: 'AM', dial: '+374', name: 'Armenia',                 flag: 'AM', pattern: /^\d{8}$/,      placeholder: '077 123 456'    },
  { code: 'AU', dial: '+61',  name: 'Australia',               flag: 'AU', pattern: /^0?\d{9}$/,    placeholder: '0412 345 678'   },
  { code: 'AT', dial: '+43',  name: 'Austria',                 flag: 'AT', pattern: /^\d{7,13}$/,   placeholder: '0664 123456'    },
  { code: 'AZ', dial: '+994', name: 'Azerbaijan',              flag: 'AZ', pattern: /^\d{9}$/,      placeholder: '050 123 45 67'  },
  // B
  { code: 'BS', dial: '+1',   name: 'Bahamas',                 flag: 'BS', pattern: /^\d{10}$/,     placeholder: '(242) 359-1234' },
  { code: 'BH', dial: '+973', name: 'Bahrain',                 flag: 'BH', pattern: /^\d{8}$/,      placeholder: '3600 0000'      },
  { code: 'BD', dial: '+880', name: 'Bangladesh',              flag: 'BD', pattern: /^0?\d{10}$/,   placeholder: '01812-345678'   },
  { code: 'BB', dial: '+1',   name: 'Barbados',                flag: 'BB', pattern: /^\d{10}$/,     placeholder: '(246) 250-1234' },
  { code: 'BY', dial: '+375', name: 'Belarus',                 flag: 'BY', pattern: /^\d{9}$/,      placeholder: '029 123 4567'   },
  { code: 'BE', dial: '+32',  name: 'Belgium',                 flag: 'BE', pattern: /^\d{9,10}$/,   placeholder: '0470 12 34 56'  },
  { code: 'BZ', dial: '+501', name: 'Belize',                  flag: 'BZ', pattern: /^\d{7}$/,      placeholder: '622 0000'       },
  { code: 'BJ', dial: '+229', name: 'Benin',                   flag: 'BJ', pattern: /^\d{8}$/,      placeholder: '97 00 00 00'    },
  { code: 'BT', dial: '+975', name: 'Bhutan',                  flag: 'BT', pattern: /^\d{8}$/,      placeholder: '17 12 34 56'    },
  { code: 'BO', dial: '+591', name: 'Bolivia',                 flag: 'BO', pattern: /^\d{8}$/,      placeholder: '71234567'       },
  { code: 'BA', dial: '+387', name: 'Bosnia and Herzegovina',  flag: 'BA', pattern: /^\d{8,9}$/,    placeholder: '061 123 456'    },
  { code: 'BW', dial: '+267', name: 'Botswana',                flag: 'BW', pattern: /^\d{7,8}$/,    placeholder: '71 234 567'     },
  { code: 'BR', dial: '+55',  name: 'Brazil',                  flag: 'BR', pattern: /^\d{10,11}$/,  placeholder: '11 91234-5678'  },
  { code: 'BN', dial: '+673', name: 'Brunei',                  flag: 'BN', pattern: /^\d{7}$/,      placeholder: '712 3456'       },
  { code: 'BG', dial: '+359', name: 'Bulgaria',                flag: 'BG', pattern: /^\d{9}$/,      placeholder: '0887 123 456'   },
  { code: 'BF', dial: '+226', name: 'Burkina Faso',            flag: 'BF', pattern: /^\d{8}$/,      placeholder: '70 12 34 56'    },
  { code: 'BI', dial: '+257', name: 'Burundi',                 flag: 'BI', pattern: /^\d{8}$/,      placeholder: '79 56 12 34'    },
  // C
  { code: 'KH', dial: '+855', name: 'Cambodia',                flag: 'KH', pattern: /^0?\d{8,9}$/,  placeholder: '012 345 678'    },
  { code: 'CM', dial: '+237', name: 'Cameroon',                flag: 'CM', pattern: /^\d{9}$/,      placeholder: '6 71 23 45 67'  },
  { code: 'CA', dial: '+1',   name: 'Canada',                  flag: 'CA', pattern: /^\d{10}$/,     placeholder: '(555) 000-0000' },
  { code: 'CV', dial: '+238', name: 'Cape Verde',              flag: 'CV', pattern: /^\d{7}$/,      placeholder: '991 23 45'      },
  { code: 'CF', dial: '+236', name: 'Central African Republic',flag: 'CF', pattern: /^\d{8}$/,      placeholder: '70 01 23 45'    },
  { code: 'TD', dial: '+235', name: 'Chad',                    flag: 'TD', pattern: /^\d{8}$/,      placeholder: '63 01 23 45'    },
  { code: 'CL', dial: '+56',  name: 'Chile',                   flag: 'CL', pattern: /^\d{9}$/,      placeholder: '9 1234 5678'    },
  { code: 'CN', dial: '+86',  name: 'China',                   flag: 'CN', pattern: /^1\d{10}$/,    placeholder: '138 0013 8000'  },
  { code: 'CO', dial: '+57',  name: 'Colombia',                flag: 'CO', pattern: /^\d{10}$/,     placeholder: '310 1234567'    },
  { code: 'KM', dial: '+269', name: 'Comoros',                 flag: 'KM', pattern: /^\d{7}$/,      placeholder: '321 23 45'      },
  { code: 'CG', dial: '+242', name: 'Congo',                   flag: 'CG', pattern: /^\d{9}$/,      placeholder: '06 123 4567'    },
  { code: 'CD', dial: '+243', name: 'Congo (DR)',              flag: 'CD', pattern: /^\d{9}$/,      placeholder: '0812 345 678'   },
  { code: 'CR', dial: '+506', name: 'Costa Rica',              flag: 'CR', pattern: /^\d{8}$/,      placeholder: '8888 8888'      },
  { code: 'HR', dial: '+385', name: 'Croatia',                 flag: 'HR', pattern: /^\d{8,9}$/,    placeholder: '091 234 5678'   },
  { code: 'CU', dial: '+53',  name: 'Cuba',                    flag: 'CU', pattern: /^\d{8}$/,      placeholder: '05 1234567'     },
  { code: 'CY', dial: '+357', name: 'Cyprus',                  flag: 'CY', pattern: /^\d{8}$/,      placeholder: '96 123456'      },
  { code: 'CZ', dial: '+420', name: 'Czech Republic',          flag: 'CZ', pattern: /^\d{9}$/,      placeholder: '601 123 456'    },
  // D
  { code: 'DK', dial: '+45',  name: 'Denmark',                 flag: 'DK', pattern: /^\d{8}$/,      placeholder: '20 12 34 56'    },
  { code: 'DJ', dial: '+253', name: 'Djibouti',                flag: 'DJ', pattern: /^\d{8}$/,      placeholder: '77 82 10 02'    },
  { code: 'DM', dial: '+1',   name: 'Dominica',                flag: 'DM', pattern: /^\d{10}$/,     placeholder: '(767) 225-1234' },
  { code: 'DO', dial: '+1',   name: 'Dominican Republic',      flag: 'DO', pattern: /^\d{10}$/,     placeholder: '(809) 234-5678' },
  // E
  { code: 'EC', dial: '+593', name: 'Ecuador',                 flag: 'EC', pattern: /^0?\d{9}$/,    placeholder: '09 9123 4567'   },
  { code: 'EG', dial: '+20',  name: 'Egypt',                   flag: 'EG', pattern: /^0?\d{10}$/,   placeholder: '0100 123 4567'  },
  { code: 'SV', dial: '+503', name: 'El Salvador',             flag: 'SV', pattern: /^\d{8}$/,      placeholder: '7012 3456'      },
  { code: 'GQ', dial: '+240', name: 'Equatorial Guinea',       flag: 'GQ', pattern: /^\d{9}$/,      placeholder: '222 123 456'    },
  { code: 'ER', dial: '+291', name: 'Eritrea',                 flag: 'ER', pattern: /^\d{7}$/,      placeholder: '7 123 456'      },
  { code: 'EE', dial: '+372', name: 'Estonia',                 flag: 'EE', pattern: /^\d{7,8}$/,    placeholder: '5123 4567'      },
  { code: 'ET', dial: '+251', name: 'Ethiopia',                flag: 'ET', pattern: /^0?\d{9}$/,    placeholder: '091 123 4567'   },
  // F
  { code: 'FJ', dial: '+679', name: 'Fiji',                    flag: 'FJ', pattern: /^\d{7}$/,      placeholder: '701 2345'       },
  { code: 'FI', dial: '+358', name: 'Finland',                 flag: 'FI', pattern: /^\d{9,10}$/,   placeholder: '040 123 4567'   },
  { code: 'FR', dial: '+33',  name: 'France',                  flag: 'FR', pattern: /^\d{9,10}$/,   placeholder: '06 12 34 56 78' },
  // G
  { code: 'GA', dial: '+241', name: 'Gabon',                   flag: 'GA', pattern: /^\d{7,8}$/,    placeholder: '06 03 12 34'    },
  { code: 'GM', dial: '+220', name: 'Gambia',                  flag: 'GM', pattern: /^\d{7}$/,      placeholder: '301 2345'       },
  { code: 'GE', dial: '+995', name: 'Georgia',                 flag: 'GE', pattern: /^\d{9}$/,      placeholder: '555 12 34 56'   },
  { code: 'DE', dial: '+49',  name: 'Germany',                 flag: 'DE', pattern: /^\d{6,12}$/,   placeholder: '0151 23456789'  },
  { code: 'GH', dial: '+233', name: 'Ghana',                   flag: 'GH', pattern: /^0?\d{9}$/,    placeholder: '024 123 4567'   },
  { code: 'GR', dial: '+30',  name: 'Greece',                  flag: 'GR', pattern: /^\d{10}$/,     placeholder: '694 123 4567'   },
  { code: 'GD', dial: '+1',   name: 'Grenada',                 flag: 'GD', pattern: /^\d{10}$/,     placeholder: '(473) 403-1234' },
  { code: 'GT', dial: '+502', name: 'Guatemala',               flag: 'GT', pattern: /^\d{8}$/,      placeholder: '5012 3456'      },
  { code: 'GN', dial: '+224', name: 'Guinea',                  flag: 'GN', pattern: /^\d{9}$/,      placeholder: '620 123 456'    },
  { code: 'GW', dial: '+245', name: 'Guinea-Bissau',           flag: 'GW', pattern: /^\d{7,9}$/,    placeholder: '955 012 345'    },
  { code: 'GY', dial: '+592', name: 'Guyana',                  flag: 'GY', pattern: /^\d{7}$/,      placeholder: '609 1234'       },
  // H
  { code: 'HT', dial: '+509', name: 'Haiti',                   flag: 'HT', pattern: /^\d{8}$/,      placeholder: '34 10 1234'     },
  { code: 'HN', dial: '+504', name: 'Honduras',                flag: 'HN', pattern: /^\d{8}$/,      placeholder: '9812 3456'      },
  { code: 'HK', dial: '+852', name: 'Hong Kong',               flag: 'HK', pattern: /^\d{8}$/,      placeholder: '5123 4567'      },
  { code: 'HU', dial: '+36',  name: 'Hungary',                 flag: 'HU', pattern: /^\d{9}$/,      placeholder: '06 20 123 4567' },
  // I
  { code: 'IS', dial: '+354', name: 'Iceland',                 flag: 'IS', pattern: /^\d{7}$/,      placeholder: '611 2345'       },
  { code: 'IN', dial: '+91',  name: 'India',                   flag: 'IN', pattern: /^\d{10}$/,     placeholder: '98765 43210'    },
  { code: 'ID', dial: '+62',  name: 'Indonesia',               flag: 'ID', pattern: /^0?\d{9,12}$/, placeholder: '081 234 5678'   },
  { code: 'IR', dial: '+98',  name: 'Iran',                    flag: 'IR', pattern: /^0?\d{10}$/,   placeholder: '0912 345 6789'  },
  { code: 'IQ', dial: '+964', name: 'Iraq',                    flag: 'IQ', pattern: /^0?\d{10}$/,   placeholder: '0771 234 5678'  },
  { code: 'IE', dial: '+353', name: 'Ireland',                 flag: 'IE', pattern: /^0?\d{9,10}$/, placeholder: '085 123 4567'   },
  { code: 'IL', dial: '+972', name: 'Israel',                  flag: 'IL', pattern: /^0?\d{9}$/,    placeholder: '050 234 5678'   },
  { code: 'IT', dial: '+39',  name: 'Italy',                   flag: 'IT', pattern: /^\d{9,10}$/,   placeholder: '312 345 6789'   },
  { code: 'CI', dial: '+225', name: 'Ivory Coast',             flag: 'CI', pattern: /^\d{8,10}$/,   placeholder: '07 12 34 56 78' },
  // J
  { code: 'JM', dial: '+1',   name: 'Jamaica',                 flag: 'JM', pattern: /^\d{10}$/,     placeholder: '(876) 210-1234' },
  { code: 'JP', dial: '+81',  name: 'Japan',                   flag: 'JP', pattern: /^0?\d{9,11}$/, placeholder: '090-1234-5678'  },
  { code: 'JO', dial: '+962', name: 'Jordan',                  flag: 'JO', pattern: /^0?\d{9}$/,    placeholder: '079 123 4567'   },
  // K
  { code: 'KZ', dial: '+7',   name: 'Kazakhstan',              flag: 'KZ', pattern: /^\d{10}$/,     placeholder: '701 234 5678'   },
  { code: 'KE', dial: '+254', name: 'Kenya',                   flag: 'KE', pattern: /^0?\d{9,10}$/, placeholder: '0712 345 678'   },
  { code: 'KI', dial: '+686', name: 'Kiribati',                flag: 'KI', pattern: /^\d{5,8}$/,    placeholder: '72001234'       },
  { code: 'KR', dial: '+82',  name: 'Korea (South)',           flag: 'KR', pattern: /^0?\d{9,10}$/, placeholder: '010-1234-5678'  },
  { code: 'KP', dial: '+850', name: 'Korea (North)',           flag: 'KP', pattern: /^\d{6,17}$/,   placeholder: '0191 23456789'  },
  { code: 'KW', dial: '+965', name: 'Kuwait',                  flag: 'KW', pattern: /^\d{8}$/,      placeholder: '5000 0000'      },
  { code: 'KG', dial: '+996', name: 'Kyrgyzstan',              flag: 'KG', pattern: /^\d{9}$/,      placeholder: '0700 123 456'   },
  // L
  { code: 'LA', dial: '+856', name: 'Laos',                    flag: 'LA', pattern: /^0?\d{8,9}$/,  placeholder: '020 23 456 789' },
  { code: 'LV', dial: '+371', name: 'Latvia',                  flag: 'LV', pattern: /^\d{8}$/,      placeholder: '21 234 567'     },
  { code: 'LB', dial: '+961', name: 'Lebanon',                 flag: 'LB', pattern: /^0?\d{7,8}$/,  placeholder: '03 123 456'     },
  { code: 'LS', dial: '+266', name: 'Lesotho',                 flag: 'LS', pattern: /^\d{8}$/,      placeholder: '5000 0000'      },
  { code: 'LR', dial: '+231', name: 'Liberia',                 flag: 'LR', pattern: /^\d{7,8}$/,    placeholder: '077 012 3456'   },
  { code: 'LY', dial: '+218', name: 'Libya',                   flag: 'LY', pattern: /^0?\d{9,10}$/, placeholder: '091-1234567'    },
  { code: 'LI', dial: '+423', name: 'Liechtenstein',           flag: 'LI', pattern: /^\d{7,9}$/,    placeholder: '660 2345'       },
  { code: 'LT', dial: '+370', name: 'Lithuania',               flag: 'LT', pattern: /^\d{8}$/,      placeholder: '612 34567'      },
  { code: 'LU', dial: '+352', name: 'Luxembourg',              flag: 'LU', pattern: /^\d{6,11}$/,   placeholder: '628 123 456'    },
  // M
  { code: 'MO', dial: '+853', name: 'Macao',                   flag: 'MO', pattern: /^\d{8}$/,      placeholder: '6612 3456'      },
  { code: 'MG', dial: '+261', name: 'Madagascar',              flag: 'MG', pattern: /^0?\d{9,10}$/, placeholder: '032 12 345 67'  },
  { code: 'MW', dial: '+265', name: 'Malawi',                  flag: 'MW', pattern: /^0?\d{9}$/,    placeholder: '0991 234 567'   },
  { code: 'MY', dial: '+60',  name: 'Malaysia',                flag: 'MY', pattern: /^0?\d{9,10}$/, placeholder: '012-3456789'    },
  { code: 'MV', dial: '+960', name: 'Maldives',                flag: 'MV', pattern: /^\d{7}$/,      placeholder: '771 2345'       },
  { code: 'ML', dial: '+223', name: 'Mali',                    flag: 'ML', pattern: /^\d{8}$/,      placeholder: '65 01 23 45'    },
  { code: 'MT', dial: '+356', name: 'Malta',                   flag: 'MT', pattern: /^\d{8}$/,      placeholder: '9961 2345'      },
  { code: 'MH', dial: '+692', name: 'Marshall Islands',        flag: 'MH', pattern: /^\d{7}$/,      placeholder: '235 1234'       },
  { code: 'MR', dial: '+222', name: 'Mauritania',              flag: 'MR', pattern: /^\d{8}$/,      placeholder: '22 12 34 56'    },
  { code: 'MU', dial: '+230', name: 'Mauritius',               flag: 'MU', pattern: /^\d{8}$/,      placeholder: '5251 2345'      },
  { code: 'MX', dial: '+52',  name: 'Mexico',                  flag: 'MX', pattern: /^\d{10}$/,     placeholder: '55 1234 5678'   },
  { code: 'FM', dial: '+691', name: 'Micronesia',              flag: 'FM', pattern: /^\d{7}$/,      placeholder: '320 1234'       },
  { code: 'MD', dial: '+373', name: 'Moldova',                 flag: 'MD', pattern: /^\d{8}$/,      placeholder: '062 612 345'    },
  { code: 'MC', dial: '+377', name: 'Monaco',                  flag: 'MC', pattern: /^\d{8,9}$/,    placeholder: '06 12 34 56 78' },
  { code: 'MN', dial: '+976', name: 'Mongolia',                flag: 'MN', pattern: /^\d{8}$/,      placeholder: '8812 3456'      },
  { code: 'ME', dial: '+382', name: 'Montenegro',              flag: 'ME', pattern: /^\d{8,9}$/,    placeholder: '067 622 901'    },
  { code: 'MA', dial: '+212', name: 'Morocco',                 flag: 'MA', pattern: /^0?\d{9,10}$/, placeholder: '0612 34 56 78'  },
  { code: 'MZ', dial: '+258', name: 'Mozambique',              flag: 'MZ', pattern: /^\d{9}$/,      placeholder: '84 123 4567'    },
  { code: 'MM', dial: '+95',  name: 'Myanmar',                 flag: 'MM', pattern: /^0?\d{8,10}$/, placeholder: '09 123 456789'  },
  // N
  { code: 'NA', dial: '+264', name: 'Namibia',                 flag: 'NA', pattern: /^0?\d{8,9}$/,  placeholder: '081 123 4567'   },
  { code: 'NR', dial: '+674', name: 'Nauru',                   flag: 'NR', pattern: /^\d{4,8}$/,    placeholder: '557 1234'       },
  { code: 'NP', dial: '+977', name: 'Nepal',                   flag: 'NP', pattern: /^0?\d{9,10}$/, placeholder: '984-1234567'    },
  { code: 'NL', dial: '+31',  name: 'Netherlands',             flag: 'NL', pattern: /^0?\d{9}$/,    placeholder: '06 12345678'    },
  { code: 'NZ', dial: '+64',  name: 'New Zealand',             flag: 'NZ', pattern: /^0?\d{8,9}$/,  placeholder: '021 123 4567'   },
  { code: 'NI', dial: '+505', name: 'Nicaragua',               flag: 'NI', pattern: /^\d{8}$/,      placeholder: '8612 3456'      },
  { code: 'NE', dial: '+227', name: 'Niger',                   flag: 'NE', pattern: /^\d{8}$/,      placeholder: '93 12 34 56'    },
  { code: 'NG', dial: '+234', name: 'Nigeria',                 flag: 'NG', pattern: /^0?\d{10}$/,   placeholder: '0812 345 6789'  },
  { code: 'MK', dial: '+389', name: 'North Macedonia',         flag: 'MK', pattern: /^\d{8}$/,      placeholder: '072 345 678'    },
  { code: 'NO', dial: '+47',  name: 'Norway',                  flag: 'NO', pattern: /^\d{8}$/,      placeholder: '406 12 345'     },
  // O
  { code: 'OM', dial: '+968', name: 'Oman',                    flag: 'OM', pattern: /^\d{8}$/,      placeholder: '9000 0000'      },
  // P
  { code: 'PK', dial: '+92',  name: 'Pakistan',                flag: 'PK', pattern: /^0?\d{10}$/,   placeholder: '0300 1234567'   },
  { code: 'PW', dial: '+680', name: 'Palau',                   flag: 'PW', pattern: /^\d{7}$/,      placeholder: '775 1234'       },
  { code: 'PS', dial: '+970', name: 'Palestine',               flag: 'PS', pattern: /^0?\d{9}$/,    placeholder: '059 123 4567'   },
  { code: 'PA', dial: '+507', name: 'Panama',                  flag: 'PA', pattern: /^\d{8}$/,      placeholder: '6000 0000'      },
  { code: 'PG', dial: '+675', name: 'Papua New Guinea',        flag: 'PG', pattern: /^\d{7,8}$/,    placeholder: '7123 4567'      },
  { code: 'PY', dial: '+595', name: 'Paraguay',                flag: 'PY', pattern: /^0?\d{9}$/,    placeholder: '0981 123456'    },
  { code: 'PE', dial: '+51',  name: 'Peru',                    flag: 'PE', pattern: /^\d{9}$/,      placeholder: '987 654 321'    },
  { code: 'PH', dial: '+63',  name: 'Philippines',             flag: 'PH', pattern: /^0?\d{10}$/,   placeholder: '0917 123 4567'  },
  { code: 'PL', dial: '+48',  name: 'Poland',                  flag: 'PL', pattern: /^\d{9}$/,      placeholder: '512 345 678'    },
  { code: 'PT', dial: '+351', name: 'Portugal',                flag: 'PT', pattern: /^\d{9}$/,      placeholder: '912 345 678'    },
  // Q
  { code: 'QA', dial: '+974', name: 'Qatar',                   flag: 'QA', pattern: /^\d{8}$/,      placeholder: '5000 0000'      },
  // R
  { code: 'RO', dial: '+40',  name: 'Romania',                 flag: 'RO', pattern: /^0?\d{9,10}$/, placeholder: '0712 345 678'   },
  { code: 'RU', dial: '+7',   name: 'Russia',                  flag: 'RU', pattern: /^\d{10}$/,     placeholder: '912 345-67-89'  },
  { code: 'RW', dial: '+250', name: 'Rwanda',                  flag: 'RW', pattern: /^0?\d{9}$/,    placeholder: '078 123 4567'   },
  // S
  { code: 'KN', dial: '+1',   name: 'Saint Kitts and Nevis',  flag: 'KN', pattern: /^\d{10}$/,     placeholder: '(869) 765-2917' },
  { code: 'LC', dial: '+1',   name: 'Saint Lucia',             flag: 'LC', pattern: /^\d{10}$/,     placeholder: '(758) 284-5678' },
  { code: 'VC', dial: '+1',   name: 'Saint Vincent',           flag: 'VC', pattern: /^\d{10}$/,     placeholder: '(784) 430-1234' },
  { code: 'WS', dial: '+685', name: 'Samoa',                   flag: 'WS', pattern: /^\d{5,7}$/,    placeholder: '72 12345'       },
  { code: 'SM', dial: '+378', name: 'San Marino',              flag: 'SM', pattern: /^\d{6,10}$/,   placeholder: '66 66 12 12'    },
  { code: 'ST', dial: '+239', name: 'Sao Tome and Principe',   flag: 'ST', pattern: /^\d{7}$/,      placeholder: '981 2345'       },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia',            flag: 'SA', pattern: /^0?\d{9}$/,    placeholder: '055 123 4567'   },
  { code: 'SN', dial: '+221', name: 'Senegal',                 flag: 'SN', pattern: /^\d{9}$/,      placeholder: '77 123 45 67'   },
  { code: 'RS', dial: '+381', name: 'Serbia',                  flag: 'RS', pattern: /^0?\d{8,9}$/,  placeholder: '060 1234567'    },
  { code: 'SC', dial: '+248', name: 'Seychelles',              flag: 'SC', pattern: /^\d{7}$/,      placeholder: '251 3456'       },
  { code: 'SL', dial: '+232', name: 'Sierra Leone',            flag: 'SL', pattern: /^\d{8}$/,      placeholder: '076 123456'     },
  { code: 'SG', dial: '+65',  name: 'Singapore',               flag: 'SG', pattern: /^\d{8}$/,      placeholder: '8123 4567'      },
  { code: 'SK', dial: '+421', name: 'Slovakia',                flag: 'SK', pattern: /^\d{9}$/,      placeholder: '0911 234 567'   },
  { code: 'SI', dial: '+386', name: 'Slovenia',                flag: 'SI', pattern: /^\d{8}$/,      placeholder: '031 234 567'    },
  { code: 'SB', dial: '+677', name: 'Solomon Islands',         flag: 'SB', pattern: /^\d{5,7}$/,    placeholder: '72 12345'       },
  { code: 'SO', dial: '+252', name: 'Somalia',                 flag: 'SO', pattern: /^0?\d{8,9}$/,  placeholder: '061 1234567'    },
  { code: 'ZA', dial: '+27',  name: 'South Africa',            flag: 'ZA', pattern: /^0?\d{9}$/,    placeholder: '082 000 0000'   },
  { code: 'SS', dial: '+211', name: 'South Sudan',             flag: 'SS', pattern: /^0?\d{9}$/,    placeholder: '0977 123 456'   },
  { code: 'ES', dial: '+34',  name: 'Spain',                   flag: 'ES', pattern: /^\d{9}$/,      placeholder: '612 345 678'    },
  { code: 'LK', dial: '+94',  name: 'Sri Lanka',               flag: 'LK', pattern: /^0?\d{9,10}$/, placeholder: '071 234 5678'   },
  { code: 'SD', dial: '+249', name: 'Sudan',                   flag: 'SD', pattern: /^0?\d{9}$/,    placeholder: '091 123 4567'   },
  { code: 'SR', dial: '+597', name: 'Suriname',                flag: 'SR', pattern: /^\d{7}$/,      placeholder: '741 2345'       },
  { code: 'SE', dial: '+46',  name: 'Sweden',                  flag: 'SE', pattern: /^0?\d{9,10}$/, placeholder: '070-123 45 67'  },
  { code: 'CH', dial: '+41',  name: 'Switzerland',             flag: 'CH', pattern: /^0?\d{9}$/,    placeholder: '079 123 45 67'  },
  { code: 'SY', dial: '+963', name: 'Syria',                   flag: 'SY', pattern: /^0?\d{9}$/,    placeholder: '0944 567 890'   },
  { code: 'SZ', dial: '+268', name: 'Eswatini',                flag: 'SZ', pattern: /^\d{8}$/,      placeholder: '7612 3456'      },
  // T
  { code: 'TW', dial: '+886', name: 'Taiwan',                  flag: 'TW', pattern: /^0?\d{9,10}$/, placeholder: '09 1234 5678'   },
  { code: 'TJ', dial: '+992', name: 'Tajikistan',              flag: 'TJ', pattern: /^\d{9}$/,      placeholder: '901 23 45 67'   },
  { code: 'TZ', dial: '+255', name: 'Tanzania',                flag: 'TZ', pattern: /^0?\d{9}$/,    placeholder: '0712 345 678'   },
  { code: 'TH', dial: '+66',  name: 'Thailand',                flag: 'TH', pattern: /^0?\d{9}$/,    placeholder: '081 234 5678'   },
  { code: 'TL', dial: '+670', name: 'Timor-Leste',             flag: 'TL', pattern: /^\d{7,8}$/,    placeholder: '7723 4567'      },
  { code: 'TG', dial: '+228', name: 'Togo',                    flag: 'TG', pattern: /^\d{8}$/,      placeholder: '90 11 23 45'    },
  { code: 'TO', dial: '+676', name: 'Tonga',                   flag: 'TO', pattern: /^\d{5,7}$/,    placeholder: '771 5000'       },
  { code: 'TT', dial: '+1',   name: 'Trinidad and Tobago',     flag: 'TT', pattern: /^\d{10}$/,     placeholder: '(868) 291-1234' },
  { code: 'TN', dial: '+216', name: 'Tunisia',                 flag: 'TN', pattern: /^\d{8}$/,      placeholder: '20 123 456'     },
  { code: 'TR', dial: '+90',  name: 'Turkey',                  flag: 'TR', pattern: /^0?\d{10}$/,   placeholder: '0532 123 4567'  },
  { code: 'TM', dial: '+993', name: 'Turkmenistan',            flag: 'TM', pattern: /^\d{8}$/,      placeholder: '6500 1234'      },
  { code: 'TV', dial: '+688', name: 'Tuvalu',                  flag: 'TV', pattern: /^\d{5,7}$/,    placeholder: '90 123'         },
  // U
  { code: 'UG', dial: '+256', name: 'Uganda',                  flag: 'UG', pattern: /^0?\d{9}$/,    placeholder: '0712 345 678'   },
  { code: 'UA', dial: '+380', name: 'Ukraine',                 flag: 'UA', pattern: /^0?\d{9}$/,    placeholder: '067 123 4567'   },
  { code: 'AE', dial: '+971', name: 'United Arab Emirates',    flag: 'AE', pattern: /^0?\d{9}$/,    placeholder: '050 123 4567'   },
  { code: 'GB', dial: '+44',  name: 'United Kingdom',          flag: 'GB', pattern: /^\d{10,11}$/,  placeholder: '07700 900000'   },
  { code: 'US', dial: '+1',   name: 'United States',           flag: 'US', pattern: /^\d{10}$/,     placeholder: '(555) 000-0000' },
  { code: 'UY', dial: '+598', name: 'Uruguay',                 flag: 'UY', pattern: /^0?\d{8,9}$/,  placeholder: '094 123 456'    },
  { code: 'UZ', dial: '+998', name: 'Uzbekistan',              flag: 'UZ', pattern: /^\d{9}$/,      placeholder: '901 234 567'    },
  // V
  { code: 'VU', dial: '+678', name: 'Vanuatu',                 flag: 'VU', pattern: /^\d{7}$/,      placeholder: '713 4567'       },
  { code: 'VE', dial: '+58',  name: 'Venezuela',               flag: 'VE', pattern: /^0?\d{10}$/,   placeholder: '0412 1234567'   },
  { code: 'VN', dial: '+84',  name: 'Vietnam',                 flag: 'VN', pattern: /^0?\d{9,10}$/, placeholder: '091 234 5678'   },
  // Y
  { code: 'YE', dial: '+967', name: 'Yemen',                   flag: 'YE', pattern: /^0?\d{9}$/,    placeholder: '071 234 5678'   },
  // Z
  { code: 'ZM', dial: '+260', name: 'Zambia',                  flag: 'ZM', pattern: /^0?\d{9}$/,    placeholder: '0955 123 456'   },
  { code: 'ZW', dial: '+263', name: 'Zimbabwe',                flag: 'ZW', pattern: /^0?\d{9,10}$/, placeholder: '071 234 5678'   },
];

function countryFlag(code: string) {
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

function parseStoredPhone(stored: string): { countryIso: string; national: string } {
  if (!stored) return { countryIso: 'PK', national: '' };
  // sort by longest dial code first to avoid +1 matching +1XX
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (stored.startsWith(c.dial + ' ')) {
      return { countryIso: c.code, national: stored.slice(c.dial.length + 1) };
    }
  }
  return { countryIso: 'PK', national: stored.replace(/^\+\d+\s*/, '') };
}

function EyeIcon({ open }: { open: boolean }) {
  return open
    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function StateChip({ state }: { state: GoogleConnection['state'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    CONNECTED:          { label: 'Connected',      cls: 'bg-emerald-50 text-emerald-700' },
    PENDING:            { label: 'Pending',         cls: 'bg-yellow-50 text-yellow-700' },
    REFRESH_FAILED:     { label: 'Token expired',   cls: 'bg-red-50 text-red-700' },
    ATTENTION_REQUIRED: { label: 'Action required', cls: 'bg-orange-50 text-orange-700' },
    REVOKED:            { label: 'Revoked',         cls: 'bg-red-50 text-red-700' },
    DISCONNECTED:       { label: 'Disconnected',    cls: 'bg-[#F3F4F6] text-[#9CA3AF]' },
    ERROR:              { label: 'Error',           cls: 'bg-red-50 text-red-700' },
  };
  const { label, cls } = map[state] ?? { label: state, cls: 'bg-[#F3F4F6] text-[#9CA3AF]' };
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${cls}`}>{label}</span>;
}

// ── PhoneInput ────────────────────────────────────────────────────────────────

function PhoneInput({
  countryIso, national, onCountryChange, onNationalChange,
}: {
  countryIso: string;
  national: string;
  onCountryChange: (iso: string) => void;
  onNationalChange: (n: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const country = (COUNTRIES.find(c => c.code === countryIso) ?? COUNTRIES[0]) as Country;
  const filteredCountries = query
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.dial.includes(query))
    : COUNTRIES;

  const isValid = national === '' || country.pattern.test(national);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex gap-2" ref={ref}>
      {/* Country picker */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setQuery(''); }}
          className="flex items-center gap-1.5 text-sm border border-[#E5EAE8] rounded-lg px-3 py-3 focus:outline-none focus:border-[#0D4C3C] transition-colors bg-white text-[#111827] whitespace-nowrap"
        >
          <span className="text-base leading-none">{countryFlag(country.flag)}</span>
          <span className="text-[#374151]">{country.dial}</span>
          <svg className={`w-3.5 h-3.5 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        </button>
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 w-64 bg-white border border-[#E5EAE8] rounded-xl shadow-lg overflow-hidden">
            <div className="px-3 pt-2.5 pb-1.5 border-b border-[#F3F4F6]">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search country..."
                className="w-full text-sm border border-[#E5EAE8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#0D4C3C]"
              />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {filteredCountries.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { onCountryChange(c.code); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${c.code === countryIso ? 'bg-[#F0F7F5] text-[#0D4C3C] font-medium' : 'text-[#374151] hover:bg-[#F8FAF9]'}`}
                >
                  <span className="text-base leading-none">{countryFlag(c.flag)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[#9CA3AF] text-xs">{c.dial}</span>
                </button>
              ))}
              {filteredCountries.length === 0 && <p className="px-4 py-3 text-sm text-[#9CA3AF]">No match</p>}
            </div>
          </div>
        )}
      </div>
      {/* National number input */}
      <div className="flex-1 relative">
        <input
          type="tel"
          value={national}
          onChange={e => onNationalChange(e.target.value.replace(/\D/g, ''))}
          placeholder={country.placeholder}
          className={`w-full text-sm text-[#111827] border rounded-lg px-4 py-3 focus:outline-none transition-colors bg-white ${
            !isValid && national !== '' ? 'border-red-400 focus:border-red-500' : 'border-[#E5EAE8] focus:border-[#0D4C3C]'
          }`}
        />
        {!isValid && national !== '' && (
          <p className="absolute -bottom-4 left-0 text-[10px] text-red-500">Invalid format for {country.name}</p>
        )}
      </div>
    </div>
  );
}

// ── TimezoneSelect ────────────────────────────────────────────────────────────

function TimezoneSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? TIMEZONES.filter(tz => tz.toLowerCase().includes(query.toLowerCase())).slice(0, 60)
    : TIMEZONES.slice(0, 60);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        className="w-full flex items-center justify-between text-sm border border-[#E5EAE8] rounded-xl px-4 py-2.5 text-left focus:outline-none focus:border-[#0D4C3C] transition-colors bg-white text-[#111827]"
      >
        <span className={value ? 'text-[#111827]' : 'text-[#9CA3AF]'}>{value || 'Select timezone...'}</span>
        <svg className={`w-4 h-4 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-[#E5EAE8] rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 pt-2.5 pb-1.5 border-b border-[#F3F4F6]">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search timezone..."
              className="w-full text-sm border border-[#E5EAE8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#0D4C3C]"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.map(tz => (
              <button
                key={tz}
                type="button"
                onClick={() => { onChange(tz); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${tz === value ? 'bg-[#F0F7F5] text-[#0D4C3C] font-medium' : 'text-[#374151] hover:bg-[#F8FAF9]'}`}
              >
                {tz}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-4 py-3 text-sm text-[#9CA3AF]">No match</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast, show: showToast } = useToast();

  // Google
  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [locations, setLocations] = useState<GoogleLocation[]>([]);
  const [connLoading, setConnLoading] = useState(true);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fetchingLocations, setFetchingLocations] = useState(false);
  const [locationLimit, setLocationLimit] = useState<number | null>(null);
  const [showLocationUpgrade, setShowLocationUpgrade] = useState(false);

  // Business search
  const [bizSearch, setBizSearch] = useState('');
  const [bizSearching, setBizSearching] = useState(false);
  const [bizResults, setBizResults] = useState<BusinessSearchResult[]>([]);
  const [addingBiz, setAddingBiz] = useState<string | null>(null);

  // Account
  const currentDisplayName = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? '';
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [savedDisplayName, setSavedDisplayName] = useState(currentDisplayName);
  const [phoneCountry, setPhoneCountry] = useState('PK');
  const [phoneNational, setPhoneNational] = useState('');
  const [origPhoneCountry, setOrigPhoneCountry] = useState('PK');
  const [origPhoneNational, setOrigPhoneNational] = useState('');
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Preferences
  const [timezone, setTimezone] = useState('');
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [origTimezone, setOrigTimezone] = useState('');

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sessions
  const [isOwner, setIsOwner] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [signingOutDevice, setSigningOutDevice] = useState(false);
  const sessionSince = user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—';

  // Export
  const [exporting, setExporting] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Load profile data
  useEffect(() => {
    if (!user) return;
    const name = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? '';
    setDisplayName(name);
    supabase.from('profiles').select('phone, timezone').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        const name2 = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? '';
        setSavedDisplayName(name2);
        const stored = (data as { phone?: string | null }).phone ?? '';
        if (stored) {
          const parsed = parseStoredPhone(stored);
          const digits = parsed.national.replace(/\D/g, '');
          setPhoneCountry(parsed.countryIso);
          setPhoneNational(digits);
          setOrigPhoneCountry(parsed.countryIso);
          setOrigPhoneNational(digits);
        }
        const tz = (data as { timezone?: string | null }).timezone ?? '';
        setTimezone(tz);
        setOrigTimezone(tz);
      }
    });
    // check owner role
    supabase
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .maybeSingle()
      .then(({ data }) => setIsOwner(!!data));
  }, [user?.id]);

  async function handleSaveAccount() {
    const trimmed = displayName.trim();
    if (!trimmed) { showToast('Display name is required.', 'error'); return; }
    const digits = phoneNational.replace(/\D/g, '');
    const country = (COUNTRIES.find(c => c.code === phoneCountry) ?? COUNTRIES[0]) as Country;
    if (digits && !country.pattern.test(digits)) {
      showToast(`Invalid phone number for ${country.name}.`, 'error');
      return;
    }
    setSavingProfile(true);
    const combined = digits ? `${country.dial} ${digits}` : null;
    const [authRes, profileRes] = await Promise.all([
      supabase.auth.updateUser({ data: { display_name: trimmed } }),
      supabase.from('profiles').update({ display_name: trimmed, phone: combined }).eq('id', user!.id),
    ]);
    if (authRes.error) { showToast(authRes.error.message, 'error'); }
    else if (profileRes.error) { showToast(profileRes.error.message, 'error'); }
    else {
      setSavedDisplayName(trimmed);
      setOrigPhoneCountry(phoneCountry);
      setOrigPhoneNational(digits);
      setPhoneNational(digits);
      setAccountEditOpen(false);
      showToast('Account updated.', 'success');
    }
    setSavingProfile(false);
  }

  async function handleSaveTimezone() {
    setSavingTimezone(true);
    const { error } = await supabase.from('profiles').update({ timezone: timezone || null }).eq('id', user!.id);
    if (error) { showToast(error.message, 'error'); }
    else { setOrigTimezone(timezone); showToast('Timezone saved.', 'success'); }
    setSavingTimezone(false);
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { showToast(error.message, 'error'); }
    else { showToast('Password changed successfully.', 'success'); setNewPassword(''); setConfirmPassword(''); }
    setSavingPassword(false);
  }

  async function handleSignOutDevice() {
    setSigningOutDevice(true);
    await supabase.auth.signOut({ scope: 'local' });
    setSigningOutDevice(false);
    navigate('/auth/login');
  }

  async function handleSignOutAllDevices() {
    setSigningOutAll(true);
    await supabase.auth.signOut({ scope: 'global' });
    setSigningOutAll(false);
    navigate('/auth/login');
  }

  async function handleExport() {
    setExporting(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { setExporting(false); return; }

    const [profileRes, reviewsRes, brainRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', u.id).maybeSingle(),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('brand_brain_profiles').select('*').order('created_at', { ascending: false }),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      profile: profileRes.data,
      reviews: reviewsRes.data ?? [],
      brand_brain: brainRes.data ?? [],
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moffu-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    showToast('Export downloaded.', 'success');
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      showToast('Could not delete account. Please contact support.', 'error');
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    navigate('/auth/login');
  }

  async function loadConnection() {
    setConnLoading(true);
    const [{ data: conn }, { data: locs }] = await Promise.all([
      googleService.getConnection(),
      googleService.getLocations(),
    ]);
    setConnection(conn ?? null);
    setLocations(locs ?? []);
    setConnLoading(false);
  }

  useEffect(() => {
    loadConnection();
    if (searchParams.get('google') === 'connected') {
      showToast('Google Business Profile connected successfully.', 'success');
      setSearchParams({}, { replace: true });
    }
    // Load plan location limit
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      const { data: sub } = await supabase
        .from('subscriptions').select('plan_id').eq('user_id', u.id).eq('status', 'active').maybeSingle();
      if (!sub) return;
      const { data: ent } = await supabase
        .from('plan_entitlements').select('value_type, limit_value')
        .eq('plan_id', sub.plan_id).eq('key', 'locations').maybeSingle();
      if (!ent) return;
      setLocationLimit(ent.value_type === 'UNLIMITED' ? null : (ent.limit_value ?? 1));
    })();
  }, []);

  async function handleConnect() {
    setConnectingGoogle(true);
    try {
      const { auth_url, error } = await googleService.startOAuth();
      if (error || !auth_url) { showToast(error ?? 'Could not start Google connection.', 'error'); setConnectingGoogle(false); return; }
      window.location.href = auth_url;
    } catch {
      showToast('Network error — could not reach server.', 'error');
      setConnectingGoogle(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Google Business Profile? Reviews will no longer sync.')) return;
    setDisconnecting(true);
    const { error } = await googleService.disconnect();
    if (error) { showToast(error, 'error'); } else { showToast('Google Business Profile disconnected.', 'success'); await loadConnection(); }
    setDisconnecting(false);
  }

  async function handleSync() {
    setSyncing(true);
    const { synced, error, errors } = await googleService.syncReviews();
    if (error) {
      showToast(error, 'error');
    } else if (errors && errors.length > 0) {
      const firstErr = errors[0] ?? 'Unknown sync error';
      showToast(`Sync error: ${firstErr.substring(0, 160)}`, 'error');
    } else {
      showToast(`Synced ${synced} review${synced !== 1 ? 's' : ''}.`, 'success');
      await loadConnection();
    }
    setSyncing(false);
  }

  async function handleFetchLocations() {
    setFetchingLocations(true);
    const { locations_fetched, error } = await googleService.fetchLocations();
    if (error) { showToast(error, 'error'); }
    else { showToast(`${locations_fetched} location(s) fetched.`, 'success'); await loadConnection(); }
    setFetchingLocations(false);
  }

  async function handleBizSearch() {
    if (!bizSearch.trim()) return;
    setBizSearching(true);
    setBizResults([]);
    const { businesses, error } = await googleService.searchBusiness(bizSearch.trim());
    if (error) showToast(error, 'error');
    else setBizResults(businesses ?? []);
    setBizSearching(false);
  }

  async function handleAddBiz(biz: BusinessSearchResult) {
    if (!connection?.id) return;
    setAddingBiz(biz.place_id);
    const { error } = await googleService.addLocationByPlaceId(
      connection.id,
      biz.place_id,
      biz.name,
      biz.address,
    );
    if (error) { showToast(error, 'error'); }
    else {
      showToast(`${biz.name} added successfully.`, 'success');
      setBizResults([]);
      setBizSearch('');
      await loadConnection();
    }
    setAddingBiz(null);
  }

  async function handleToggleLocation(id: string, current: boolean) {
    if (!current && locationLimit !== null) {
      const selectedCount = locations.filter(l => l.is_selected).length;
      if (selectedCount >= locationLimit) {
        setShowLocationUpgrade(true);
        return;
      }
    }
    await googleService.toggleLocationSelected(id, !current);
    setLocations(prev => prev.map(l => l.id === id ? { ...l, is_selected: !current } : l));
  }

  const isConnected = connection?.state === 'CONNECTED';
  const isAttentionRequired = connection?.state === 'ATTENTION_REQUIRED';
  const inputCls = 'w-full text-sm text-[#111827] border border-[#E5EAE8] rounded-lg px-4 py-3 focus:outline-none focus:border-[#0D4C3C] transition-colors bg-white';

  return (
    <div className="px-8 py-8">
      <div className="mb-7">
        <h1 className="text-[1.5rem] font-bold text-[#111827]">Settings</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Manage your account and preferences.</p>
      </div>

      {/* Row 1 — Account + Change Password */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Account */}
        <div className="bg-white rounded-xl border border-[#E5EAE8]">
          <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Account</h2>
            {!accountEditOpen && (
              <button
                type="button"
                onClick={() => setAccountEditOpen(true)}
                className="text-xs font-medium text-[#0D4C3C] hover:underline"
              >
                Edit
              </button>
            )}
          </div>
          <div className="px-6 py-5 space-y-4">
            {!accountEditOpen ? (
              <>
                <div>
                  <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1">Display Name</p>
                  <p className="text-sm text-[#111827]">{savedDisplayName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1">Email</p>
                  <p className="text-sm text-[#111827]">{user?.email ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1">Phone Number</p>
                  <p className={`text-sm ${origPhoneNational ? 'text-[#111827]' : 'text-[#9CA3AF]'}`}>
                    {origPhoneNational
                      ? `${countryFlag(origPhoneCountry)} ${COUNTRIES.find(c => c.code === origPhoneCountry)?.dial ?? ''} ${origPhoneNational}`
                      : 'Not set'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Email</label>
                  <p className="text-sm text-[#111827] bg-[#F8FAF9] border border-[#E5EAE8] rounded-lg px-4 py-3">{user?.email ?? '—'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Phone Number</label>
                  <PhoneInput
                    countryIso={phoneCountry}
                    national={phoneNational}
                    onCountryChange={setPhoneCountry}
                    onNationalChange={v => setPhoneNational(v.replace(/\D/g, ''))}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveAccount}
                    disabled={savingProfile || !displayName.trim()}
                    className="text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] px-5 py-2.5 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    {savingProfile ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayName(savedDisplayName);
                      setPhoneCountry(origPhoneCountry);
                      setPhoneNational(origPhoneNational);
                      setAccountEditOpen(false);
                    }}
                    className="text-sm font-medium text-[#6B7280] hover:text-[#374151] px-5 py-2.5 rounded-lg border border-[#E5EAE8] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-sm font-semibold text-[#111827]">Change Password</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={`${inputCls} pr-10`}
                />
                <button type="button" onClick={() => setShowNewPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]">
                  <EyeIcon open={showNewPassword} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className={`${inputCls} pr-10`}
                />
                <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]">
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
            </div>
            <button
              onClick={handleChangePassword}
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] px-5 py-2.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              {savingPassword ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>

      {/* Row 2 — Preferences + Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Preferences */}
        <div className="bg-white rounded-xl border border-[#E5EAE8]">
          <div className="px-6 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-sm font-semibold text-[#111827]">Preferences</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Timezone</label>
              <TimezoneSelect value={timezone} onChange={setTimezone} />
              <p className="text-[11px] text-[#9CA3AF] mt-1.5">Used for review timestamps and scheduled reports.</p>
            </div>
            <button
              onClick={handleSaveTimezone}
              disabled={savingTimezone || timezone === origTimezone}
              className="text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] px-5 py-2.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              {savingTimezone ? 'Saving...' : 'Save timezone'}
            </button>
          </div>
        </div>

        {/* Sessions */}
        <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-sm font-semibold text-[#111827]">Active Sessions</h2>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <svg className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#111827]">This device</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">Member since {sessionSince}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Active</span>
                {isOwner && (
                  <button
                    onClick={handleSignOutDevice}
                    disabled={signingOutDevice}
                    className="text-xs font-medium text-[#6B7280] hover:text-red-600 border border-[#E5EAE8] px-2.5 py-0.5 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    {signingOutDevice ? 'Logging out...' : 'Logout'}
                  </button>
                )}
              </div>
            </div>
            {isOwner && (
              <button
                onClick={handleSignOutAllDevices}
                disabled={signingOutAll}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-40 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                {signingOutAll ? 'Signing out...' : 'Sign out all devices'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Integrations</h2>
        </div>
        <div className="px-6 py-5">
          {connLoading ? (
            <div className="animate-pulse flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F3F4F6]" />
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-[#F3F4F6] rounded w-40" />
                <div className="h-2.5 bg-[#F3F4F6] rounded w-56" />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border border-[#E5EAE8] flex items-center justify-center bg-white">
                    <GoogleIcon />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#111827]">Google Business Profile</p>
                    {isConnected && connection?.google_email
                      ? <p className="text-xs text-[#6B7280]">{connection.google_email}</p>
                      : <p className="text-xs text-[#9CA3AF]">Connect to sync reviews automatically</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {connection && <StateChip state={connection.state} />}
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <button onClick={handleSync} disabled={syncing}
                        className="text-xs font-medium text-[#0D4C3C] border border-[#D1D5DB] rounded-lg px-3 py-1.5 hover:bg-[#F3F8F6] transition-colors disabled:opacity-50">
                        {syncing ? 'Syncing...' : 'Sync now'}
                      </button>
                      <button onClick={handleDisconnect} disabled={disconnecting}
                        className="text-xs font-medium text-red-600 border border-[#FCA5A5] rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50">
                        {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    </div>
                  ) : isAttentionRequired ? (
                    <div className="flex items-center gap-2">
                      <button onClick={handleFetchLocations} disabled={fetchingLocations}
                        className="text-xs font-semibold text-white bg-[#0D4C3C] rounded-lg px-4 py-1.5 hover:bg-[#0a3d30] transition-colors disabled:opacity-50">
                        {fetchingLocations ? 'Fetching...' : 'Retry fetch locations'}
                      </button>
                      <button onClick={handleDisconnect} disabled={disconnecting}
                        className="text-xs font-medium text-red-600 border border-[#FCA5A5] rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50">
                        {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={handleConnect} disabled={connectingGoogle}
                      className="text-xs font-semibold text-white bg-[#0D4C3C] rounded-lg px-4 py-1.5 hover:bg-[#0a3d30] transition-colors disabled:opacity-50">
                      {connectingGoogle ? 'Redirecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
              {isAttentionRequired && connection?.error_message && (
                <div className="mt-4 border-t border-[#F3F4F6] pt-4">
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <strong>Action required:</strong> {connection.error_message.replace(/ensure.*Console\./i, 'Make sure "My Business Account Management API" and "My Business Business Information API" are enabled in Google Cloud Console.')}
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-2">Once APIs are enabled, click <strong>Retry fetch locations</strong> above — no need to reconnect.</p>
                </div>
              )}
              {isConnected && locations.length > 0 && (
                <div className="mt-5 border-t border-[#F3F4F6] pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Locations to sync</p>
                    {locationLimit !== null && (
                      <span className="text-[11px] text-[#9CA3AF]">
                        {locations.filter(l => l.is_selected).length}/{locationLimit} on your plan
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {locations.map(loc => {
                      const selectedCount = locations.filter(l => l.is_selected).length;
                      const wouldExceed = !loc.is_selected && locationLimit !== null && selectedCount >= locationLimit;
                      return (
                        <div key={loc.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#F8FAF9] transition-colors">
                          <div>
                            <p className="text-sm font-medium text-[#111827]">{loc.display_name ?? loc.google_location_name}</p>
                            {loc.address && <p className="text-xs text-[#9CA3AF]">{loc.address}</p>}
                          </div>
                          <button
                            onClick={() => handleToggleLocation(loc.id, loc.is_selected)}
                            title={wouldExceed ? 'Upgrade to enable more locations' : undefined}
                            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${loc.is_selected ? 'bg-[#0D4C3C]' : wouldExceed ? 'bg-[#E5E7EB]' : 'bg-[#D1D5DB]'}`}
                            role="switch" aria-checked={loc.is_selected}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${loc.is_selected ? 'translate-x-4' : ''}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Location upgrade modal */}
              {showLocationUpgrade && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowLocationUpgrade(false)}>
                  <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-7 text-center" onClick={e => e.stopPropagation()}>
                    <div className="w-12 h-12 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                    </div>
                    <h2 className="text-base font-bold text-[#111827] mb-1">Location limit reached</h2>
                    <p className="text-sm text-[#6B7280] mb-5 leading-relaxed">
                      Your current plan allows up to <strong>{locationLimit}</strong> location{locationLimit !== 1 ? 's' : ''}. Upgrade to manage more locations.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowLocationUpgrade(false)}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-[#374151] border border-[#E5EAE8] rounded-xl hover:bg-[#F9FAFB] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => { setShowLocationUpgrade(false); navigate('/billing'); }}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] rounded-xl transition-colors"
                      >
                        View Plans
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {isConnected && locations.length === 0 && (
                <div className="mt-5 border-t border-[#F3F4F6] pt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-[#374151] mb-0.5">Find your business on Google</p>
                    <p className="text-xs text-[#9CA3AF]">Search by business name to add your location.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={bizSearch}
                      onChange={e => setBizSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleBizSearch()}
                      placeholder="e.g. Black Drivo DHA Lahore"
                      className="flex-1 text-sm border border-[#E5EAE8] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0D4C3C] bg-white text-[#111827]"
                    />
                    <button
                      onClick={handleBizSearch}
                      disabled={bizSearching || !bizSearch.trim()}
                      className="text-xs font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] px-4 py-2 rounded-lg disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {bizSearching ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  {bizResults.length > 0 && (
                    <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
                      {bizResults.map((biz, i) => (
                        <div
                          key={biz.place_id}
                          className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-[#F3F4F6]' : ''} hover:bg-[#F8FAF9] transition-colors`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#111827] truncate">{biz.name}</p>
                            {biz.address && <p className="text-xs text-[#9CA3AF] truncate">{biz.address}</p>}
                            {biz.rating != null && (
                              <p className="text-xs text-[#6B7280] mt-0.5">★ {biz.rating} · {biz.reviews_count ?? 0} reviews</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleAddBiz(biz)}
                            disabled={addingBiz === biz.place_id}
                            className="ml-3 text-xs font-semibold text-[#0D4C3C] border border-[#0D4C3C] px-3 py-1.5 rounded-lg hover:bg-[#E6F2EE] disabled:opacity-40 transition-colors whitespace-nowrap flex-shrink-0"
                          >
                            {addingBiz === biz.place_id ? 'Adding...' : 'Add'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {bizResults.length === 0 && bizSearch && !bizSearching && (
                    <p className="text-xs text-[#9CA3AF]">No results yet. Try searching with your business name and city.</p>
                  )}
                </div>
              )}
              {isConnected && connection?.last_synced_at && (
                <p className="mt-4 text-xs text-[#9CA3AF]">Last synced: {new Date(connection.last_synced_at).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Billing shortcut */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Billing</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#111827]">Plan &amp; Usage</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">View your plan, usage and upgrade options.</p>
            </div>
            <Link to="/billing"
              className="text-xs font-semibold text-[#0D4C3C] border border-[#0D4C3C] px-3.5 py-1.5 rounded-lg hover:bg-[#E6F2EE] transition-colors">
              Go to Billing &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Data &amp; Privacy</h2>
        </div>
        <div className="px-6 py-5 space-y-5">

          {/* Export */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#111827]">Export my data</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Download your profile, reviews and Brand Brain as JSON.</p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0D4C3C] border border-[#0D4C3C] px-3.5 py-1.5 rounded-lg hover:bg-[#E6F2EE] disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>

          {/* Delete account */}
          <div className="border-t border-[#F3F4F6] pt-5">
            {!showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Delete account</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">Permanently delete your account and all data. This cannot be undone.</p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs font-semibold text-red-600 border border-red-200 px-3.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                >
                  Delete account
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-red-600">Are you absolutely sure?</p>
                <p className="text-xs text-[#6B7280]">All your data — reviews, replies, Brand Brain profiles and team memberships — will be permanently deleted. This action <strong>cannot be undone</strong>.</p>
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Type <strong>DELETE</strong> to confirm</label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full text-sm border border-[#E5EAE8] rounded-lg px-3 py-2 focus:outline-none focus:border-red-400 bg-white text-[#111827]"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirmText !== 'DELETE'}
                    className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    {deleting ? 'Deleting...' : 'Permanently delete my account'}
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                    className="text-xs font-medium text-[#6B7280] hover:text-[#374151] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => {}} />}
    </div>
  );
}
