import { buildPdf } from '../buildPdf'
import { MATRESHKA } from '../brands'

export const buildPriceListPdf = (rows, options) => buildPdf(rows, options, MATRESHKA)
