import { rgb } from 'pdf-lib'

const c = (hex) =>
  rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255)

export const MATRESHKA = {
  dir: 'matreshka',
  palette: { g9: c('7a1b22'), g7: c('a8262f'), g5: c('c8972b'), ink: c('2a1a14'), ink7: c('4a3a30'), muted: c('8a7a6a'), line: c('e6d9c2'), paper: c('fbf4e6') },
  logo: null,                                   // text wordmark instead of a logo image
  wordmark: ['MATRЁSHKA', 'Чистота с юга России'],
  title: 'Прайс-лист MATRЁSHKA · оптовые цены',
  priceHeader: ['Цена ₽, дистр.', 7],
  mail: 'info@kubanbithim.ru',
  footer: 'ООО «КубаньБытХим» · ТМ MATRЁSHKA · г. Новороссийск, ул. Кутузовская, 117 · +7 (8617) 60-00-88 · info@kubanbithim.ru',
}

export const GREENPANDA = {
  dir: 'greenpanda',
  palette: { g9: c('0f3d2e'), g7: c('10743f'), g5: c('1fb061'), ink: c('0a1f18'), ink7: c('1f352b'), muted: c('6b7a72'), line: c('d7ddd8'), paper: c('fbf6ec') },
  logo: 'logo.png',
  wordmark: null,
  title: 'Прайс-лист GREEN PANDA · оптовые цены',
  priceHeader: ['Цена с НДС, самовывоз', 6.6],
  mail: 'sales@greenpanda-eco.ru',
  footer: 'ООО «КубаньБытХим» · г. Новороссийск, ул. Кутузовская, 117 · +7 (8617) 60-00-88 · sales@greenpanda-eco.ru',
}
