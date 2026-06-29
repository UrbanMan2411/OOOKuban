import React from 'react'
import GeneratorPanel from './GeneratorPanel'
import { buildPriceListPdf } from '../../generators/greenpanda/buildPdf'

export default function GreenPanda() {
  return (
    <GeneratorPanel
      title="GreenPanda · генератор прайса"
      sub="Загрузите .xlsx эталонного прайса GreenPanda — получите PDF с фирменным эко-оформлением. Фото берутся из файла, белый фон убирается автоматически."
      brand="greenpanda"
      bgSwatch="/greenpanda/bg.jpg"
      downloadName="greenpanda-pricelist.pdf"
      buildPdf={buildPriceListPdf}
    />
  )
}
