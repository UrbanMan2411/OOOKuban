import { buildPdf } from '../buildPdf'
import { GREENPANDA } from '../brands'

export const buildPriceListPdf = (rows, options) => buildPdf(rows, options, GREENPANDA)
