'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'

export default function PlanoPdfButton() {
  const [gerando, setGerando] = useState(false)

  async function handleGerar() {
    const element = document.getElementById('pdf-preview')
    if (!element) return

    setGerando(true)

    try {
      // Importar dinamicamente para não aumentar o bundle inicial
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])

      // Capturar o elemento com alta resolução
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      })

      const imgData = canvas.toDataURL('image/png')

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth  = pdf.internal.pageSize.getWidth()   // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight()  // 297mm
      const margin     = 10 // mm

      const printWidth  = pageWidth - margin * 2
      const imgHeightMm = (canvas.height * printWidth) / canvas.width

      let posY = 0
      let paginaRestante = pageHeight - margin

      // Adicionar imagem página a página
      pdf.addImage(imgData, 'PNG', margin, margin, printWidth, imgHeightMm)

      let alturaRestante = imgHeightMm - paginaRestante

      while (alturaRestante > 0) {
        pdf.addPage()
        const offsetY = margin - (imgHeightMm - alturaRestante)
        pdf.addImage(imgData, 'PNG', margin, offsetY, printWidth, imgHeightMm)
        alturaRestante -= (pageHeight - margin)
      }

      // Abrir o PDF numa nova aba (blob URL)
      const blob  = pdf.output('blob')
      const url   = URL.createObjectURL(blob)
      window.open(url, '_blank')

      // Limpar após 60s
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <button
      className="btn-primary no-print"
      onClick={handleGerar}
      disabled={gerando}
    >
      {gerando
        ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando PDF...</>
        : <><FileDown className="w-4 h-4" /> Gerar PDF</>
      }
    </button>
  )
}
