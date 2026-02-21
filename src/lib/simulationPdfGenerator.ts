import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SimulationResult {
    type: string;
    inputData: any;
    resultData: any;
    createdAt: Date;
}

export const generateSimulationPDF = async (simulation: SimulationResult) => {
    const doc = new jsPDF() as any;
    const margin = 14;

    let currentY = 0;

    // Header (Ocultar para GPS para salvar espaço)
    if (simulation.type !== 'GPS_TRIMESTRAL' && simulation.type !== 'GPS_MENSAL') {
        doc.setFontSize(18);
        doc.text("Memória de Cálculo Jurídico", margin, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Tipo: ${simulation.type} | Data: ${new Date(simulation.createdAt).toLocaleDateString('pt-BR')}`, margin, 28);

        doc.setDrawColor(200);
        doc.line(margin, 32, 196, 32);
        currentY = 45;
    } else {
        currentY = 15; // Começar mais no topo para GPS
    }

    // Seções baseadas no tipo
    if (simulation.type === 'JUDICIAL_UPDATE') {
        renderJudicialSection(doc, simulation, margin, currentY);
    } else if (simulation.type === 'BANK_REVISION') {
        renderBankingSection(doc, simulation, margin, currentY);
    } else if (simulation.type === 'LABOR_RESCISAO') {
        renderLaborSection(doc, simulation, margin, currentY);
    } else if (simulation.type === 'FAMILY_PENSION') {
        renderFamilySection(doc, simulation, margin, currentY);
    } else if (simulation.type === 'GPS_TRIMESTRAL' || simulation.type === 'GPS_MENSAL') {
        renderGpsSection(doc, simulation, margin, currentY);
    } else if (simulation.type === 'SOCIAL_SECURITY_LATE') {
        renderSocialSecurityLateSection(doc, simulation, margin, currentY);
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`SaaS Jurídico - Página ${i} de ${pageCount}`, margin, doc.internal.pageSize.height - 10);
    }

    doc.save(`Calculo_${simulation.type}_${Date.now()}.pdf`);
};

function renderJudicialSection(doc: any, sim: any, x: number, y: number) {
    const input = sim.inputData;
    const res = sim.resultData;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("1. PARÂMETROS E ÍNDICES", x, y);

    autoTable(doc, {
        startY: y + 5,
        body: [
            ["Índice Pré-EC", input.preECIndex, "Juros Pré-EC", `${input.interestRatePreEC}% am`],
            ["SELIC Pós-EC", input.useSelicAfterEC113 ? "Sim" : "Não", "Data Final", input.endDate]
        ],
        theme: 'grid',
        styles: { fontSize: 8 }
    });

    y = doc.lastAutoTable.finalY + 12;
    doc.text("2. LANÇAMENTOS E ATUALIZAÇÕES", x, y);

    const tableEntries = res.entries.map((e: any) => [
        new Date(e.date).toLocaleDateString('pt-BR'),
        `${e.type === 'DEBIT' ? 'Débito' : 'Amort.'}${e.repeatIndebito ? ' (x2)' : ''}`,
        `R$ ${parseFloat(e.value).toFixed(2)}`,
        `R$ ${parseFloat(e.correctedValue).toFixed(2)}`,
        `R$ ${e.remuneratoryRate}%`,
        `R$ ${parseFloat(e.remuneratory).toFixed(2)}`,
        `R$ ${e.moraRate}%`,
        `R$ ${parseFloat(e.interest).toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: y + 5,
        head: [["Data", "Tipo", "Valor Orig.", "V. Atualiz.", "Rem.%", "J. Remun.", "Mora%", "J. Mora"]],
        body: tableEntries,
        theme: 'striped',
        styles: { fontSize: 6 },
        headStyles: { fillColor: [40, 40, 40] }
    });

    y = doc.lastAutoTable.finalY + 12;
    doc.text("3. RESUMO DA EXECUÇÃO (CPC)", x, y);

    const summaryBody = [
        ["SUBTOTAL ATUALIZADO", `R$ ${res.subtotal}`],
        ["TOTAL JUROS REMUNERATÓRIOS", `R$ ${res.totalRemuneratory}`],
        ["TOTAL JUROS MORATÓRIOS", `R$ ${res.totalInterest}`],
        ["TOTAL CORREÇÃO MONETÁRIA", `R$ ${res.totalCorrection}`]
    ];

    if (parseFloat(res.fine523) > 0) summaryBody.push(["MULTA ART. 523 CPC (10%)", `R$ ${res.fine523}`]);
    if (parseFloat(res.fees523) > 0) summaryBody.push(["HONORÁRIOS ART. 523 CPC", `R$ ${res.fees523}`]);
    if (parseFloat(res.feesSucumbenciais) > 0) summaryBody.push(["HONORÁRIOS SUCUMBENCIAIS", `R$ ${res.feesSucumbenciais}`]);

    autoTable(doc, {
        startY: y + 5,
        head: [["Descrição", "Valor"]],
        body: summaryBody,
        foot: [["TOTAL GERAL DA EXECUÇÃO", `R$ ${res.grandTotal}`]],
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [80, 80, 80] },
        footStyles: { fillColor: [40, 40, 40], fontSize: 10 }
    });
}

function renderBankingSection(doc: any, sim: any, x: number, y: number) {
    doc.setFontSize(14);
    doc.text("1. Comparação de Contrato", x, y);
    const res = sim.resultData;

    autoTable(doc, {
        startY: y + 5,
        head: [["Cenário", "Parcela", "Total Pago"]],
        body: [
            ["Contratado", `R$ ${res.contractedPmt}`, `R$ ${res.contractedTotal}`],
            ["Recalculado", `R$ ${res.recalculatedPmt}`, `R$ ${res.recalculatedTotal}`]
        ],
        theme: 'striped'
    });

    y = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.text(`Economia Estimada: R$ ${res.difference} (${res.savingsPercentage}%)`, x, y);
}

function renderLaborSection(doc: any, sim: any, x: number, y: number) {
    doc.setFontSize(14);
    doc.text("1. Verbas Rescisórias", x, y);
    const res = sim.resultData;

    autoTable(doc, {
        startY: y + 5,
        head: [["Rubrica", "Valor"]],
        body: [
            ["13º Salário", `R$ ${res.thirteenth}`],
            ["Férias + 1/3", `R$ ${res.vacation}`],
            ["Aviso Prévio", `R$ ${res.notice}`],
            ["Multa FGTS (40%)", `R$ ${res.fgtsFine}`],
            ["TOTAL LÍQUIDO", `R$ ${res.total}`]
        ],
        theme: 'grid'
    });
}

function renderFamilySection(doc: any, sim: any, x: number, y: number) {
    doc.setFontSize(14);
    doc.text("1. Cálculo de Alimentos", x, y);
    const res = sim.resultData;
    const input = sim.inputData;

    autoTable(doc, {
        startY: y + 5,
        body: [
            ["Renda Líquida", `R$ ${input.netIncome}`],
            ["Percentual", `${input.percentage}%`],
            ["Dependentes", input.numDependents],
            ["Total Pensão", `R$ ${res.total}`],
            ["Valor por Filho", `R$ ${res.perDependent}`]
        ],
        theme: 'striped'
    });
}

function renderGpsSection(doc: any, sim: any, x: number, y: number) {
    const res = sim.resultData;
    const input = sim.inputData;

    // 1. Memória de Cálculo no Topo (Compacta)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("MEMÓRIA DE CÁLCULO DETALHADA", x, y);

    autoTable(doc, {
        startY: y + 1,
        margin: { left: x },
        styles: { fontSize: 7, cellPadding: 1 },
        body: [
            ["Base de Cálculo", `R$ ${input.salarioBase}`],
            ["Alíquota", `${res.memoria.aliquota}%`],
            ["Valor Mensal", `R$ ${res.memoria.valorMensal}`],
            ["Período", res.memoria.isTrimestral ? "3 Meses (Trimestre)" : "1 Mês (Mensal)"],
            ["Subtotal Principal", `R$ ${res.valorPrincipal}`],
            ["Multa", `R$ ${res.multa}`],
            ["Juros", `R$ ${res.juros}`],
            ["TOTAL", `R$ ${res.total}`]
        ],
        theme: 'grid'
    });

    y = doc.lastAutoTable.finalY + 10;

    // 2. Primeira Via (Contribuinte)
    renderSingleGpsGuide(doc, input, res, x, y, "1ª VIA - CONTRIBUINTE");

    y += 100;

    // Linha de Recorte
    doc.setDrawColor(200);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(x, y - 5, x + 180, y - 5);
    doc.setFontSize(5);
    doc.setTextColor(180);
    doc.text("cortar nesta linha", x + 90, y - 6, { align: "center" });
    doc.setLineDashPattern([], 0);
    doc.setTextColor(0);

    // 3. Segunda Via (Ente Recebedor)
    renderSingleGpsGuide(doc, input, res, x, y, "2ª VIA - ENTE RECEBEDOR");
}

function renderSingleGpsGuide(doc: any, input: any, res: any, x: number, y: number, viaLabel: string) {
    const leftW = 110;
    const rightW = 70;
    const rowH = 7.5;
    const totalH = rowH * 9; // 9 boxes in total (3 to 11)

    doc.setDrawColor(0);
    doc.setLineWidth(0.3);

    // --- CABEÇALHO E IDENTIFICAÇÃO (CAMPOS 01, 03, 04, 05) ---
    // Logos e Nomes
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("MINISTÉRIO DA PREVIDÊNCIA SOCIAL - MPS", x + 42, y + 4);
    doc.text("INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS", x + 42, y + 7.5);
    doc.text("SECRETARIA DA RECEITA PREVIDENCIÁRIA - SRP", x + 42, y + 11);

    doc.setFontSize(8);
    doc.text("GUIA DA PREVIDÊNCIA SOCIAL - GPS", x + 55, y + 18);

    doc.setFontSize(5);
    doc.setTextColor(150);
    doc.text(viaLabel, x + 180, y + 4, { align: "right" });
    doc.setTextColor(0);

    const gridY = y + 21;

    // Grid Esq (Identificação) - Alinhado com boxes 3, 4, 5
    doc.rect(x, gridY, leftW, rowH * 3);
    doc.setFontSize(5);
    doc.text("1 - NOME OU RAZÃO SOCIAL / FONE / ENDEREÇO", x + 2, gridY + 3.5);
    doc.setFontSize(8.5);
    doc.text(input.nome.toUpperCase(), x + 2, gridY + 9);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`NIT/PIS/PASEP: ${input.nit}`, x + 2, gridY + 14);

    // Box 02 (Vencimento) - Alinhado com box 6
    const box2Y = gridY + (rowH * 3);
    doc.rect(x, box2Y, leftW, rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.text("2 - VENCIMENTO (Uso exclusivo INSS)", x + 2, box2Y + 4.5);
    doc.line(x + 75, box2Y, x + 75, box2Y + rowH);
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(res.vencimento, x + 108, box2Y + 5.5, { align: "right" });

    // Box de Atenção - Alinhado com boxes 7, 8
    const attentionY = box2Y + rowH;
    doc.rect(x, attentionY, leftW, rowH * 2);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.text("ATENÇÃO:", x + 2, attentionY + 4.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.5);
    doc.text([
        "É vedada a utilização de GPS para recolhimento de receita de valor",
        "inferior ao estipulado em resolução publicada pelo INSS. A receita que resultar valor",
        "inferior deverá ser adicionada à contribuição ou importância correspondente nos",
        "meses subsequentes, até que o total seja igual ou superior ao valor mínimo fixado."
    ], x + 12, attentionY + 4.5, { maxWidth: leftW - 15 });

    // Autenticação - Alinhado com boxes 9, 10, 11
    const authY = attentionY + (rowH * 2);
    doc.rect(x, authY, leftW, rowH * 3);
    doc.setFontSize(5);
    doc.text("AUTENTICAÇÃO BANCÁRIA", x + 108, authY + (rowH * 3) - 2.5, { align: "right" });

    // --- COLUNA DIREITA (CAMPOS 03 a 11) ---
    const renderRightBox = (num: string, label: string, value: string, rowIdx: number, isTotal = false) => {
        const fieldY = gridY + (rowIdx * rowH);
        doc.rect(x + leftW, fieldY, rightW, rowH);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.text(`${num} - ${label}`, x + leftW + 1.5, fieldY + 3.5);

        doc.setFont("courier", "bold");
        doc.setFontSize(isTotal ? 10 : 9);
        doc.text(value, x + 180 - 1.5, fieldY + 6.5, { align: "right" });
    };

    renderRightBox("3", "CÓDIGO DE PAGAMENTO", res.codigo, 0);
    renderRightBox("4", "COMPETÊNCIA", res.competencia, 1);
    renderRightBox("5", "IDENTIFICADOR", input.nit, 2);
    renderRightBox("6", "VALOR DO INSS", `R$ ${res.valorPrincipal}`, 3);
    renderRightBox("7", "", "", 4);
    renderRightBox("8", "", "", 5);
    renderRightBox("9", "VALOR OUTRAS ENTIDADES", "0,00", 6);
    renderRightBox("10", "ATM/MULTA E JUROS", `R$ ${(parseFloat(res.multa) + parseFloat(res.juros)).toFixed(2)}`, 7);
    renderRightBox("11", "TOTAL", `R$ ${res.total}`, 8, true);

    // Footer
    doc.setFontSize(4);
    doc.setFont("helvetica", "normal");
    doc.text("gerado por www.agg.com.br", x, authY + (rowH * 3) + 2.5);
}

function renderSocialSecurityLateSection(doc: any, sim: any, x: number, y: number) {
    const res = sim.resultData;
    const input = sim.inputData;

    // ── CABEÇALHO DO MEMORIAL ──────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("MEMORIAL DE CÁLCULO — INSS EM ATRASO", x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} | Art. 35 da Lei 8.212/91`, x, y + 4.5);
    doc.setTextColor(0);

    y += 7;
    doc.setDrawColor(180);
    doc.line(x, y, 196, y);
    y += 4;

    // ── BLOCO 1: IDENTIFICAÇÃO + RISCO (2 colunas) ─────────────────────────
    const codigoGps = res.modalidade === 'NORMAL'
        ? (input.tipoSegurado === 'INDIVIDUAL' ? '1007' : '1406')
        : (res.modalidade === 'SIMPLIFICADO'
            ? (input.tipoSegurado === 'INDIVIDUAL' ? '1163' : '1473')
            : '1929');

    const colW = 88;
    const colGap = 5;
    const col2X = x + colW + colGap;

    // Coluna esquerda — Identificação do segurado
    autoTable(doc, {
        startY: y,
        margin: { left: x, right: 107 },
        styles: { fontSize: 7, cellPadding: 1.2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 }, 1: { cellWidth: 50 } },
        body: [
            ["Segurado", res.nomeSegurado || "—"],
            ["NIT/PIS/PASEP", res.nit || "—"],
            ["Competência", res.competencia ? res.competencia.split('-').reverse().join('/') : "—"],
            ["Vencimento Orig.", res.originalDueDate || "—"],
            ["Dt. Pagamento", res.paymentDate ? res.paymentDate.split('-').reverse().join('/') : "—"],
        ],
        theme: 'grid',
    });

    // Coluna direita — Análise de Risco
    const nivelCor = res.risco.nivel === 'BAIXO' ? [39, 174, 96]
        : res.risco.nivel === 'MÉDIO' ? [230, 126, 34]
            : [192, 57, 43];

    autoTable(doc, {
        startY: y,
        margin: { left: col2X, right: 14 },
        styles: { fontSize: 7, cellPadding: 1.2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 }, 1: { cellWidth: 56 } },
        body: [
            ["Nível de Risco", { content: res.risco.nivel, styles: { textColor: nivelCor, fontStyle: 'bold' } }],
            ["Cód. GPS", codigoGps],
            ["Limite Qualidade", res.risco.infoGrace?.dataLimite || "N/D"],
            ["Salário Mínimo", `R$ ${res.minWageUsed}`],
            ["Alíquota", `${res.aliquotaUsed}%`],
        ],
        theme: 'grid',
    });

    y = doc.lastAutoTable.finalY + 3;

    // Parecer técnico compacto
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(80);
    const parecer = `Parecer: ${res.risco.observacao}`;
    const linhasParecer = doc.splitTextToSize(parecer, 182);
    doc.text(linhasParecer, x, y);
    doc.setTextColor(0);
    y += (linhasParecer.length * 3) + 2;

    // ── BLOCO 2: ENCARGOS ──────────────────────────────────────────────────
    autoTable(doc, {
        startY: y,
        margin: { left: x },
        head: [["RUBRICA", "BASE / ALÍQUOTA", "VALOR"]],
        body: [
            ["Contribuição Principal", `R$ ${res.minWageUsed} × ${res.aliquotaUsed}%`, `R$ ${res.principal}`],
            ["Multa de Mora (0,33%/dia)", "Máx. 20%", `R$ ${res.fine}`],
            [`Juros de Mora (SELIC ${(res.selicAcumulada * 100).toFixed(2)}%)`, "Acumulado + 1%", `R$ ${res.interest}`],
        ],
        foot: [["TOTAL DEVIDO (campo 11 da GPS)", "", `R$ ${res.total}`]],
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 30, 30], fontSize: 6.5, textColor: [255, 255, 255] },
        footStyles: { fillColor: [20, 20, 20], fontSize: 8.5, textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 60 }, 2: { halign: 'right' } },
    });

    y = doc.lastAutoTable.finalY + 2;

    // Nota legal
    doc.setFont("helvetica", "italic");
    doc.setFontSize(5.5);
    doc.setTextColor(120);
    doc.text("* Juros calculados pela SELIC acumulada a partir do mês seguinte ao vencimento + 1% no mês do pagamento (Lei 9.430/96 e Res. INSS).", x, y);
    doc.setTextColor(0);
    y += 5;

    // ── LINHA SEPARADORA ──────────────────────────────────────────────────
    doc.setDrawColor(100);
    doc.line(x, y, 196, y);
    y += 3;

    // ── GPS — DUAS VIAS ────────────────────────────────────────────────────
    const gpsInput = {
        nome: res.nomeSegurado || "NÃO INFORMADO",
        nit: res.nit || "NÃO INFORMADO"
    };

    const gpsRes = {
        codigo: codigoGps,
        competencia: (res.competencia || "").split('-').reverse().join('/'),
        vencimento: (res.paymentDate || "").split('-').reverse().join('/'),
        valorPrincipal: res.principal,
        multa: (parseFloat(res.fine || "0") + parseFloat(res.interest || "0")).toFixed(2),
        juros: "0,00",
        total: res.total
    };

    renderCompactGpsGuide(doc, gpsInput, gpsRes, x, y, "1ª VIA — CONTRIBUINTE");

    y += 77;

    // Linha de recorte
    doc.setDrawColor(180);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(x, y - 2, 196, y - 2);
    doc.setFontSize(5);
    doc.setTextColor(160);
    doc.text("✂  recortar aqui", 105, y - 3.5, { align: "center" });
    doc.setLineDashPattern([], 0);
    doc.setTextColor(0);

    y += 1;
    renderCompactGpsGuide(doc, gpsInput, gpsRes, x, y, "2ª VIA — ENTE RECEBEDOR");
}

function renderCompactGpsGuide(doc: any, input: any, res: any, x: number, y: number, viaLabel: string) {
    const leftW = 108;
    const rightW = 74;
    const rowH = 7;
    const pageW = x + leftW + rightW; // 196

    doc.setDrawColor(0);
    doc.setLineWidth(0.25);

    // ── CABEÇALHO ────────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("MINISTÉRIO DA PREVIDÊNCIA SOCIAL — INSS", x + 38, y + 3.5);
    doc.setFontSize(8);
    doc.text("GUIA DA PREVIDÊNCIA SOCIAL — GPS", x + 52, y + 9);
    doc.setFontSize(4.5);
    doc.setTextColor(130);
    doc.text(viaLabel, pageW, y + 4, { align: "right" });
    doc.setTextColor(0);

    const gridY = y + 12;

    // ── COLUNA ESQUERDA ───────────────────────────────────────────────────
    // Box 1 — Nome / NIT (altura 3 rows)
    doc.rect(x, gridY, leftW, rowH * 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.5);
    doc.text("1 – NOME / NIT / FONE / ENDEREÇO", x + 2, gridY + 3);
    doc.setFontSize(8);
    doc.text(input.nome.substring(0, 34).toUpperCase(), x + 2, gridY + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(`NIT: ${input.nit}`, x + 2, gridY + 14.5);

    // Box 2 — Vencimento
    const b2Y = gridY + rowH * 3;
    doc.rect(x, b2Y, leftW, rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.5);
    doc.text("2 – VENCIMENTO (Uso exclusivo INSS)", x + 2, b2Y + 4);
    doc.line(x + 70, b2Y, x + 70, b2Y + rowH);
    doc.setFont("courier", "bold");
    doc.setFontSize(8);
    doc.text(res.vencimento, x + leftW - 2, b2Y + 5.5, { align: "right" });

    // Box Atenção
    const attY = b2Y + rowH;
    doc.rect(x, attY, leftW, rowH * 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.5);
    doc.text("ATENÇÃO:", x + 2, attY + 3.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4);
    doc.text([
        "É vedada a utilização de GPS para recolhimento de valor inferior ao mínimo",
        "estipulado. O valor inferior deverá ser acumulado e recolhido no mês seguinte.",
    ], x + 14, attY + 3.5, { maxWidth: leftW - 16 });

    // Box Autenticação
    const authY = attY + rowH * 2;
    doc.rect(x, authY, leftW, rowH * 3);
    doc.setFontSize(4.5);
    doc.setFont("helvetica", "normal");
    doc.text("AUTENTICAÇÃO BANCÁRIA / CARIMBO", x + leftW - 2, authY + rowH * 3 - 2, { align: "right" });
    doc.setFontSize(4);
    doc.setTextColor(160);
    doc.text("gerado via sistema AGG", x + 2, authY + rowH * 3 - 2);
    doc.setTextColor(0);

    // ── COLUNA DIREITA (campos 3–11) ──────────────────────────────────────
    const renderBox = (num: string, label: string, value: string, rowIdx: number, bold = false) => {
        const fy = gridY + rowIdx * rowH;
        doc.rect(x + leftW, fy, rightW, rowH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.5);
        doc.text(`${num} – ${label}`, x + leftW + 1.5, fy + 3.5);
        doc.setFont("courier", "bold");
        doc.setFontSize(bold ? 9.5 : 8.5);
        doc.text(value, x + leftW + rightW - 1.5, fy + 6.5, { align: "right" });
    };

    renderBox("3", "CÓDIGO DE PAGAMENTO", res.codigo, 0);
    renderBox("4", "COMPETÊNCIA", res.competencia, 1);
    renderBox("5", "IDENTIFICADOR", input.nit, 2);
    renderBox("6", "VALOR DO INSS (R$)", res.valorPrincipal, 3);
    renderBox("7", "—", "", 4);
    renderBox("8", "—", "", 5);
    renderBox("9", "OUTRAS ENTIDADES (R$)", "0,00", 6);
    renderBox("10", "ATM + MULTA + JUROS (R$)", res.multa, 7);
    renderBox("11", "TOTAL (R$)", res.total, 8, true);
}

