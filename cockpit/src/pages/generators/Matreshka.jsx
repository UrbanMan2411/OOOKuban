import React from 'react'
import GeneratorPanel from './GeneratorPanel'
import { buildPriceListPdf } from '../../generators/matreshka/buildPdf'

export default function Matreshka() {
  return (
    <GeneratorPanel
      title="MATRЁSHKA · генератор прайса"
      sub="Загрузите .xlsx эталонного прайса MATRЁSHKA — получите PDF с фирменным оформлением. Фото берутся из самого файла, белый фон у изображений убирается автоматически."
      brand="matreshka"
      bgSwatch="/matreshka/bg.jpg"
      downloadName="matreshka-pricelist.pdf"
      buildPdf={buildPriceListPdf}
    />
  )
}
