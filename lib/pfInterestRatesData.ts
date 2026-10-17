export interface OfficialInterestRate {
  id: string;
  sNo: number;
  financialYear: string;
  fromDate: string;
  toDate: string;
  rate: number;
  authority: string;
  cpsAuthority?: string;
  attachmentName?: string;
  attachmentUrl?: string;
}

/**
 * TAMILNADU GOVT. EMPLOYEES - GPF & CPS - RATES OF INTEREST
 * தமிழ்நாடு அரசுப் பணியாளர்கள் - பொது வருங்கால வைப்பு நிதி & பங்களிப்பு ஓய்வூதியத் திட்டம் - வட்டி வீதம்
 * Starting FY from 1970-71 up to 2026-09-30
 */
export const OFFICIAL_PF_INTEREST_RATES: OfficialInterestRate[] = [
  { id: 'rate_9', sNo: 9, financialYear: '1970-71', fromDate: '1970-04-01', toDate: '1971-03-31', rate: 5.5, authority: '1217, 07.10.1970', cpsAuthority: '' },
  { id: 'rate_10', sNo: 10, financialYear: '1971-72', fromDate: '1971-04-01', toDate: '1972-03-31', rate: 5.7, authority: '871, 16.06.1971', cpsAuthority: '' },
  { id: 'rate_11', sNo: 11, financialYear: '1972-73', fromDate: '1972-04-01', toDate: '1973-03-31', rate: 6.0, authority: '869, 10.07.1973', cpsAuthority: '' },
  { id: 'rate_12', sNo: 12, financialYear: '1973-74', fromDate: '1973-04-01', toDate: '1974-03-31', rate: 6.0, authority: '940, 30.07.1973', cpsAuthority: '' },
  { id: 'rate_13', sNo: 13, financialYear: '1974-75', fromDate: '1974-04-01', toDate: '1975-03-31', rate: 7.2, authority: '283, 22.03.1975', cpsAuthority: '' },
  { id: 'rate_14', sNo: 14, financialYear: '1975-76', fromDate: '1975-04-01', toDate: '1976-03-31', rate: 7.5, authority: '571, 18.06.1975', cpsAuthority: '' },
  { id: 'rate_15', sNo: 15, financialYear: '1976-77', fromDate: '1976-04-01', toDate: '1977-03-31', rate: 7.5, authority: '665, 23.06.1976', cpsAuthority: '' },
  { id: 'rate_16', sNo: 16, financialYear: '1977-78', fromDate: '1977-04-01', toDate: '1978-03-31', rate: 7.5, authority: '637, 07.7.1977', cpsAuthority: '' },
  { id: 'rate_17', sNo: 17, financialYear: '1978-79', fromDate: '1978-04-01', toDate: '1979-03-31', rate: 7.5, authority: '968, 07.09.1978', cpsAuthority: '' },
  { id: 'rate_18', sNo: 18, financialYear: '1979-80', fromDate: '1979-04-01', toDate: '1980-03-31', rate: 8.0, authority: '1368, 06.10.1979', cpsAuthority: '' },
  { id: 'rate_19', sNo: 19, financialYear: '1980-81', fromDate: '1980-04-01', toDate: '1981-03-31', rate: 8.5, authority: '923, 29.09.1980', cpsAuthority: '' },
  { id: 'rate_20', sNo: 20, financialYear: '1981-82', fromDate: '1981-04-01', toDate: '1982-03-31', rate: 9.0, authority: '497, 20.07.1981', cpsAuthority: '' },
  { id: 'rate_21', sNo: 21, financialYear: '1982-83', fromDate: '1982-04-01', toDate: '1983-03-31', rate: 9.0, authority: '589, 07.09.1982', cpsAuthority: '' },
  { id: 'rate_22', sNo: 22, financialYear: '1983-84', fromDate: '1983-04-01', toDate: '1984-03-31', rate: 9.5, authority: '1041, 22.12.1983', cpsAuthority: '' },
  { id: 'rate_23', sNo: 23, financialYear: '1984-85', fromDate: '1984-04-01', toDate: '1985-03-31', rate: 10.0, authority: '476, 05.07.1984', cpsAuthority: '' },
  { id: 'rate_24', sNo: 24, financialYear: '1985-86', fromDate: '1985-04-01', toDate: '1986-03-31', rate: 10.5, authority: '802, 24.07.1985', cpsAuthority: '' },
  { id: 'rate_25', sNo: 25, financialYear: '1986-87', fromDate: '1986-04-01', toDate: '1987-03-31', rate: 12.0, authority: '678, 08.08.1986', cpsAuthority: '' },
  { id: 'rate_26', sNo: 26, financialYear: '1987-88', fromDate: '1987-04-01', toDate: '1988-03-31', rate: 12.0, authority: '758, 26.08.1987', cpsAuthority: '' },
  { id: 'rate_27', sNo: 27, financialYear: '1988-89', fromDate: '1988-04-01', toDate: '1989-03-31', rate: 12.0, authority: '319, 06.05.1988', cpsAuthority: '' },
  { id: 'rate_28', sNo: 28, financialYear: '1989-90', fromDate: '1989-04-01', toDate: '1990-03-31', rate: 12.0, authority: '688, 05.7.1989', cpsAuthority: '' },
  { id: 'rate_29', sNo: 29, financialYear: '1990-91', fromDate: '1990-04-01', toDate: '1991-03-31', rate: 12.0, authority: '712, 28.06.1990', cpsAuthority: '' },
  { id: 'rate_30', sNo: 30, financialYear: '1991-92', fromDate: '1991-04-01', toDate: '1992-03-31', rate: 12.0, authority: '632, 28.08.1991', cpsAuthority: '' },
  { id: 'rate_31', sNo: 31, financialYear: '1992-93', fromDate: '1992-04-01', toDate: '1993-03-31', rate: 12.0, authority: '863, 09.11.1992', cpsAuthority: '' },
  { id: 'rate_32', sNo: 32, financialYear: '1993-94', fromDate: '1993-04-01', toDate: '1994-03-31', rate: 12.0, authority: '462, 02.07.1993', cpsAuthority: '' },
  { id: 'rate_33', sNo: 33, financialYear: '1994-95', fromDate: '1994-04-01', toDate: '1995-03-31', rate: 12.0, authority: '499, 15.06.1994', cpsAuthority: '' },
  { id: 'rate_34', sNo: 34, financialYear: '1995-96', fromDate: '1995-04-01', toDate: '1996-03-31', rate: 12.0, authority: '681, 21.08.1995', cpsAuthority: '' },
  { id: 'rate_35', sNo: 35, financialYear: '1996-97', fromDate: '1996-04-01', toDate: '1997-03-31', rate: 12.0, authority: '664, 18.11.1996', cpsAuthority: '' },
  { id: 'rate_36', sNo: 36, financialYear: '1997-98', fromDate: '1997-04-01', toDate: '1998-03-31', rate: 12.0, authority: '167, 20.04.1998', cpsAuthority: '' },
  { id: 'rate_37', sNo: 37, financialYear: '1998-99', fromDate: '1998-04-01', toDate: '1999-03-31', rate: 12.0, authority: '164, 22.04.1999', cpsAuthority: '' },
  { id: 'rate_38', sNo: 38, financialYear: '1999-2000', fromDate: '1999-04-01', toDate: '2000-03-31', rate: 12.0, authority: '414, 08.09.2000', cpsAuthority: '' },
  { id: 'rate_39', sNo: 39, financialYear: '2000-01', fromDate: '2000-04-01', toDate: '2001-03-31', rate: 11.0, authority: '207, 18.05.2000', cpsAuthority: '' },
  { id: 'rate_40', sNo: 40, financialYear: '2001-02', fromDate: '2001-04-01', toDate: '2002-03-31', rate: 9.5, authority: '224, 07.06.2001', cpsAuthority: '' },
  { id: 'rate_41', sNo: 41, financialYear: '2002-03', fromDate: '2002-04-01', toDate: '2003-03-31', rate: 9.0, authority: '151, 06.05.2002', cpsAuthority: '' },
  { id: 'rate_42', sNo: 42, financialYear: '2003-04', fromDate: '2003-04-01', toDate: '2004-03-31', rate: 8.0, authority: '125, 17.04.2003', cpsAuthority: '222, 03.06.2008' },
  { id: 'rate_43', sNo: 43, financialYear: '2004-05', fromDate: '2004-04-01', toDate: '2005-03-31', rate: 8.0, authority: '441, 16.08.2004', cpsAuthority: '38, 11.02.2013' },
  { id: 'rate_44', sNo: 44, financialYear: '2005-06', fromDate: '2005-04-01', toDate: '2006-03-31', rate: 8.0, authority: '', cpsAuthority: '38, 11.02.2013' },
  { id: 'rate_45', sNo: 45, financialYear: '2006-07', fromDate: '2006-04-01', toDate: '2007-03-31', rate: 8.0, authority: '', cpsAuthority: '38, 11.02.2013' },
  { id: 'rate_46', sNo: 46, financialYear: '2007-08', fromDate: '2007-04-01', toDate: '2008-03-31', rate: 8.0, authority: '', cpsAuthority: '38, 11.02.2013' },
  { id: 'rate_47', sNo: 47, financialYear: '2008-09', fromDate: '2008-04-01', toDate: '2009-03-31', rate: 8.0, authority: '530, 09.11.2009', cpsAuthority: '38, 11.02.2013' },
  { id: 'rate_48', sNo: 48, financialYear: '2009-10', fromDate: '2009-04-01', toDate: '2010-03-31', rate: 8.0, authority: '530, 09.11.2009', cpsAuthority: '38, 11.02.2013' },
  { id: 'rate_49', sNo: 49, financialYear: '2010-11', fromDate: '2010-04-01', toDate: '2011-03-31', rate: 8.0, authority: '', cpsAuthority: '38, 11.02.2013' },
  { id: 'rate_50', sNo: 50, financialYear: '04/2011-11/2011', fromDate: '2011-04-01', toDate: '2011-11-30', rate: 8.0, authority: '', cpsAuthority: '38, 11.02.2013' },
  { id: 'rate_51', sNo: 51, financialYear: '12/2011-03/2012', fromDate: '2011-12-01', toDate: '2012-03-31', rate: 8.6, authority: '106, 30.03.2012', cpsAuthority: '38, 11.02.2013' },
  { id: 'rate_52', sNo: 52, financialYear: '2012-13', fromDate: '2012-04-01', toDate: '2013-03-31', rate: 8.8, authority: '127, 19.04.2013', cpsAuthority: '115, 09.05.2013' },
  { id: 'rate_53', sNo: 53, financialYear: '2013-14', fromDate: '2013-04-01', toDate: '2014-03-31', rate: 8.7, authority: '127, 19.04.2013', cpsAuthority: '115, 09.05.2013' },
  { id: 'rate_54', sNo: 54, financialYear: '2014-15', fromDate: '2014-04-01', toDate: '2015-03-31', rate: 8.7, authority: '106, 28.04.2014', cpsAuthority: '183, 26.06.2015' },
  { id: 'rate_55', sNo: 55, financialYear: '2015-16', fromDate: '2015-04-01', toDate: '2016-03-31', rate: 8.7, authority: '129, 27.04.2015', cpsAuthority: '183, 26.06.2015' },
  { id: 'rate_56', sNo: 56, financialYear: '04/2016-06/2016', fromDate: '2016-04-01', toDate: '2016-06-30', rate: 8.1, authority: '209, 15.07.2016', cpsAuthority: '219, 27.07.2016' },
  { id: 'rate_57', sNo: 57, financialYear: '07/2016-09/2016', fromDate: '2016-07-01', toDate: '2016-09-30', rate: 8.1, authority: '231, 09.08.2016', cpsAuthority: '234, 11.08.2016' },
  { id: 'rate_58', sNo: 58, financialYear: '10/2016-12/2016', fromDate: '2016-10-01', toDate: '2016-12-31', rate: 8.0, authority: '276, 24.10.2016', cpsAuthority: '279, 27.10.2016' },
  { id: 'rate_59', sNo: 59, financialYear: '01/2017-03/2017', fromDate: '2017-01-01', toDate: '2017-03-31', rate: 8.0, authority: '35, 25.04.2017', cpsAuthority: '54, 06.03.2017' },
  { id: 'rate_60', sNo: 60, financialYear: '04/2017-06/2017', fromDate: '2017-04-01', toDate: '2017-06-30', rate: 7.9, authority: '102, 25.04.2017', cpsAuthority: '125, 08.05.2017' },
  { id: 'rate_61', sNo: 61, financialYear: '07/2017-09/2017', fromDate: '2017-07-01', toDate: '2017-09-30', rate: 7.8, authority: '227, 28.07.2017', cpsAuthority: '240, 08.08.2017' },
  { id: 'rate_62', sNo: 62, financialYear: '10/2017-12/2017', fromDate: '2017-10-01', toDate: '2017-12-31', rate: 7.8, authority: '320, 27.10.2017', cpsAuthority: '330, 01.11.2017' },
  { id: 'rate_63', sNo: 63, financialYear: '01/2018-03/2018', fromDate: '2018-01-01', toDate: '2018-03-31', rate: 7.6, authority: '11, 10.01.2018', cpsAuthority: '16, 18.01.2018' },
  { id: 'rate_64', sNo: 64, financialYear: '04/2018-06/2018', fromDate: '2018-04-01', toDate: '2018-06-30', rate: 7.6, authority: '135, 23.04.2018', cpsAuthority: '152, 02.05.2018' },
  { id: 'rate_65', sNo: 65, financialYear: '07/2018-09/2018', fromDate: '2018-07-01', toDate: '2018-09-30', rate: 7.6, authority: '252, 26.07.2018', cpsAuthority: '271, 13.08.2018' },
  { id: 'rate_66', sNo: 66, financialYear: '10/2018-12/2018', fromDate: '2018-10-01', toDate: '2018-12-31', rate: 8.0, authority: '337, 12.10.2018', cpsAuthority: '352, 30.10.2018' },
  { id: 'rate_67', sNo: 67, financialYear: '01/2019-03/2019', fromDate: '2019-01-01', toDate: '2019-03-31', rate: 8.0, authority: '25, 21.01.2019', cpsAuthority: '50, 06.02.2019' },
  { id: 'rate_68', sNo: 68, financialYear: '04/2019-06/2019', fromDate: '2019-04-01', toDate: '2019-06-30', rate: 8.0, authority: '126, 24.04.2019', cpsAuthority: '150, 15.05.2019' },
  { id: 'rate_69', sNo: 69, financialYear: '07/2019-09/2019', fromDate: '2019-07-01', toDate: '2019-09-30', rate: 7.9, authority: '223, 18.07.2019', cpsAuthority: '263, 14.08.2019' },
  { id: 'rate_70', sNo: 70, financialYear: '10/2019-12/2019', fromDate: '2019-10-01', toDate: '2019-12-31', rate: 7.9, authority: '334, 24.10.2019', cpsAuthority: '361, 08.11.2019' },
  { id: 'rate_71', sNo: 71, financialYear: '01/2020-03/2020', fromDate: '2020-01-01', toDate: '2020-03-31', rate: 7.9, authority: '14, 27.01.2020', cpsAuthority: '29, 19.02.2020' },
  { id: 'rate_72', sNo: 72, financialYear: '04/2020-06/2020', fromDate: '2020-04-01', toDate: '2020-06-30', rate: 7.1, authority: '231, 23.04.2020', cpsAuthority: '236, 04.05.2020' },
  { id: 'rate_73', sNo: 73, financialYear: '07/2020-09/2020', fromDate: '2020-07-01', toDate: '2020-09-30', rate: 7.1, authority: '306, 27.07.2020', cpsAuthority: '350, 24.09.2020' },
  { id: 'rate_74', sNo: 74, financialYear: '10/2020-12/2020', fromDate: '2020-10-01', toDate: '2020-12-31', rate: 7.1, authority: '386, 02.11.2020', cpsAuthority: '394, 10.11.2020' },
  { id: 'rate_75', sNo: 75, financialYear: '01/2021-03/2021', fromDate: '2021-01-01', toDate: '2021-03-31', rate: 7.1, authority: '30, 22.01.2021', cpsAuthority: '51, 22.02.2021' },
  { id: 'rate_76', sNo: 76, financialYear: '04/2021-06/2021', fromDate: '2021-04-01', toDate: '2021-06-30', rate: 7.1, authority: '125, 28.04.2021', cpsAuthority: '132, 24.05.2021' },
  { id: 'rate_77', sNo: 77, financialYear: '07/2021-09/2021', fromDate: '2021-07-01', toDate: '2021-09-30', rate: 7.1, authority: '173, 19.07.2021', cpsAuthority: '183, 03.08.2021' },
  { id: 'rate_78', sNo: 78, financialYear: '10/2021-12/2021', fromDate: '2021-10-01', toDate: '2021-12-31', rate: 7.1, authority: '238, 26.10.2021', cpsAuthority: '' },
  { id: 'rate_79', sNo: 79, financialYear: '01/2022-03/2022', fromDate: '2022-01-01', toDate: '2022-03-31', rate: 7.1, authority: '29, 27.01.2022', cpsAuthority: '' },
  { id: 'rate_80', sNo: 80, financialYear: '04/2022-06/2022', fromDate: '2022-04-01', toDate: '2022-06-30', rate: 7.1, authority: '109, 19.04.2022', cpsAuthority: '' },
  { id: 'rate_81', sNo: 81, financialYear: '07/2022-09/2022', fromDate: '2022-07-01', toDate: '2022-09-30', rate: 7.1, authority: '227, 26.07.2022', cpsAuthority: '' },
  { id: 'rate_82', sNo: 82, financialYear: '10/2022-12/2022', fromDate: '2022-10-01', toDate: '2022-12-31', rate: 7.1, authority: '335, 22.10.2022', cpsAuthority: '' },
  { id: 'rate_83', sNo: 83, financialYear: '01/2023-03/2023', fromDate: '2023-01-01', toDate: '2023-03-31', rate: 7.1, authority: '21, 23.01.2023', cpsAuthority: '' },
  { id: 'rate_84', sNo: 84, financialYear: '04/2023-06/2023', fromDate: '2023-04-01', toDate: '2023-06-30', rate: 7.1, authority: '115, 25.04.2023', cpsAuthority: '' },
  { id: 'rate_85', sNo: 85, financialYear: '07/2023-09/2023', fromDate: '2023-07-01', toDate: '2023-09-30', rate: 7.1, authority: '225, 17.07.2023', cpsAuthority: '' },
  { id: 'rate_86', sNo: 86, financialYear: '10/2023-12/2023', fromDate: '2023-10-01', toDate: '2023-12-31', rate: 7.1, authority: '229, 12.10.2023', cpsAuthority: '' },
  { id: 'rate_87', sNo: 87, financialYear: '01/2024-06/2024', fromDate: '2024-01-01', toDate: '2024-06-30', rate: 7.1, authority: '13, 08.01.2024', cpsAuthority: '' },
  { id: 'rate_88', sNo: 88, financialYear: '07/2024-09/2024', fromDate: '2024-07-01', toDate: '2024-09-30', rate: 7.1, authority: '260, 06.08.2024', cpsAuthority: '' },
  { id: 'rate_89', sNo: 89, financialYear: '10/2024-12/2024', fromDate: '2024-10-01', toDate: '2024-12-31', rate: 7.1, authority: '325, 25.10.2024', cpsAuthority: '' },
  { id: 'rate_90', sNo: 90, financialYear: '01/2025-03/2025', fromDate: '2025-01-01', toDate: '2025-03-31', rate: 7.1, authority: '10, 21.01.2025', cpsAuthority: '' },
  { id: 'rate_91', sNo: 91, financialYear: '04/2025-06/2025', fromDate: '2025-04-01', toDate: '2025-06-30', rate: 7.1, authority: '83, 07.04.2025', cpsAuthority: '' },
  { id: 'rate_92', sNo: 92, financialYear: '07/2025-09/2025', fromDate: '2025-07-01', toDate: '2025-09-30', rate: 7.1, authority: '163, 15.07.2025', cpsAuthority: '' },
  { id: 'rate_93', sNo: 93, financialYear: '10/2025-03/2026', fromDate: '2025-10-01', toDate: '2026-03-31', rate: 7.1, authority: '13, 19.01.2026', cpsAuthority: '' },
  { id: 'rate_94', sNo: 94, financialYear: '04/2026-09/2026', fromDate: '2026-04-01', toDate: '2026-09-30', rate: 7.1, authority: '145, 24.07.2026', cpsAuthority: '' }
];
