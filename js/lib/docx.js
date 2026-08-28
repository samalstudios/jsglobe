import { writeZip } from '../core/zip.js';

const escapeXml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const TWIP = (points) => Math.round(points * 20);
const HALF = (points) => Math.round(points * 2);

const hex = (colour) => {
  if (!colour) return null;
  const value = String(colour).trim();
  if (value.startsWith('#')) {
    const body = value.slice(1);
    return (body.length === 3 ? [...body].map((c) => c + c).join('') : body.slice(0, 6)).toUpperCase();
  }
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(',').map((part) => Number(part.trim()));
  return parts
    .slice(0, 3)
    .map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
};

const runXml = (run, links) => {
  const props = [];
  if (run.bold) props.push('<w:b/>');
  if (run.italic) props.push('<w:i/>');
  if (run.underline) props.push('<w:u w:val="single"/>');
  if (run.strike) props.push('<w:strike/>');
  if (run.sup) props.push('<w:vertAlign w:val="superscript"/>');
  if (run.sub) props.push('<w:vertAlign w:val="subscript"/>');
  const colour = hex(run.color);
  if (colour) props.push(`<w:color w:val="${colour}"/>`);
  const back = hex(run.highlight);
  if (back) props.push(`<w:shd w:val="clear" w:fill="${back}"/>`);
  if (run.font || run.mono) {
    const family = run.mono ? 'Consolas' : run.font;
    props.push(`<w:rFonts w:ascii="${escapeXml(family)}" w:hAnsi="${escapeXml(family)}"/>`);
  }
  if (run.size) props.push(`<w:sz w:val="${HALF(run.size * 0.75)}"/>`);
  if (run.link) props.push('<w:rStyle w:val="Hyperlink"/>');

  const pieces = String(run.text ?? '').split('\n');
  const body = pieces
    .map((piece, index) => `${index ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(piece)}</w:t>`)
    .join('');
  const xml = `<w:r>${props.length ? `<w:rPr>${props.join('')}</w:rPr>` : ''}${body}</w:r>`;

  if (!run.link) return xml;
  const id = `rId${links.length + 100}`;
  links.push({ id, target: run.link });
  return `<w:hyperlink r:id="${id}">${xml}</w:hyperlink>`;
};

const ALIGN = { left: 'left', center: 'center', right: 'right', justify: 'both' };

const HEADING_SIZE = { h1: 26, h2: 20, h3: 16, h4: 14, h5: 12, h6: 11 };

const paragraphXml = (block, links) => {
  const props = [];
  const style = /^h[1-6]$/.test(block.type) ? `Heading${block.type.slice(1)}` : null;
  if (style) props.push(`<w:pStyle w:val="${style}"/>`);
  if (block.type === 'quote') props.push('<w:pStyle w:val="Quote"/>');
  if (block.type === 'code') props.push('<w:pStyle w:val="Code"/>');
  if (block.type === 'bullet') props.push('<w:numPr><w:ilvl w:val="' + (block.depth ?? 0) + '"/><w:numId w:val="1"/></w:numPr>');
  if (block.type === 'ordered') props.push('<w:numPr><w:ilvl w:val="' + (block.depth ?? 0) + '"/><w:numId w:val="2"/></w:numPr>');
  if (block.align && ALIGN[block.align] && block.align !== 'left') props.push(`<w:jc w:val="${ALIGN[block.align]}"/>`);
  if (block.indent) props.push(`<w:ind w:left="${TWIP(block.indent * 36)}"/>`);

  const runs = (block.runs ?? []).map((run) => runXml(run, links)).join('');
  return `<w:p>${props.length ? `<w:pPr>${props.join('')}</w:pPr>` : ''}${runs}</w:p>`;
};

const tableXml = (block, links) => {
  const rows = block.rows
    .map((row) => {
      const cells = row
        .map((cell) => {
          const shade = cell.head ? '<w:shd w:val="clear" w:fill="F1F3F5"/>' : '';
          const runs = cell.runs.map((run) => runXml({ ...run, bold: run.bold || cell.head }, links)).join('');
          return `<w:tc><w:tcPr>${shade}</w:tcPr><w:p>${runs}</w:p></w:tc>`;
        })
        .join('');
      return `<w:tr>${cells}</w:tr>`;
    })
    .join('');
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:color="D0D5DA"/>`)
    .join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr>${rows}</w:tbl>`;
};

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  ${[1, 2, 3, 4, 5, 6]
    .map(
      (level) =>
        `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="${level - 1}"/><w:spacing w:before="${240 - level * 20}" w:after="${120 - level * 10}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${HALF(HEADING_SIZE[`h${level}`])}"/></w:rPr></w:style>`,
    )
    .join('')}
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>
</w:styles>`;

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  ${[0, 1]
    .map((which) => {
      const levels = [0, 1, 2, 3, 4]
        .map(
          (level) =>
            `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${which ? 'decimal' : 'bullet'}"/><w:lvlText w:val="${which ? `%${level + 1}.` : '•'}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (level + 1)}" w:hanging="360"/></w:pPr></w:lvl>`,
        )
        .join('');
      return `<w:abstractNum w:abstractNumId="${which}">${levels}</w:abstractNum>`;
    })
    .join('')}
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

const EMU = (points) => Math.round(points * 12700);

const drawingXml = (picture, index) => {
  const width = EMU(picture.drawWidth);
  const height = EMU(picture.drawHeight);
  return (
    `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${index + 1}" name="Picture ${index + 1}"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${index + 1}" name="Picture ${index + 1}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${picture.id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  );
};

export async function writeDocx(blocks, options = {}) {
  const links = [];
  const pictures = [];
  const width = options.width ?? 595.28;
  const height = options.height ?? 841.89;
  const margin = options.margin ?? 72;

  const body = blocks
    .map((block) => {
      if (block.type === 'table') return tableXml(block, links);
      if (block.type === 'break') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      if (block.type === 'rule') return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:color="C8CDD2"/></w:pBdr></w:pPr></w:p>';
      if (block.type === 'image') {
        if (!block.jpeg?.data) return '<w:p/>';
        const index = pictures.length;
        const room = (options.width ?? 595.28) - (options.margin ?? 72) * 2;
        const drawWidth = Math.min(room, block.width || room);
        const picture = {
          id: `rIdImage${index}`,
          name: `media/image${index + 1}.jpeg`,
          data: block.jpeg.data,
          drawWidth,
          drawHeight: drawWidth * (block.jpeg.ratio ?? 0.6),
        };
        pictures.push(picture);
        return drawingXml(picture, index);
      }
      return paragraphXml(block, links);
    })
    .join('');

  const section =
    `<w:sectPr><w:pgSz w:w="${TWIP(width)}" w:h="${TWIP(height)}"/>` +
    `<w:pgMar w:top="${TWIP(margin)}" w:right="${TWIP(margin)}" w:bottom="${TWIP(margin)}" w:left="${TWIP(margin)}"/></w:sectPr>`;

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>${body}${section}</w:body>
</w:document>`;

  const relations = links
    .map(
      (link) =>
        `<Relationship Id="${link.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(link.target)}" TargetMode="External"/>`,
    )
    .concat(
      pictures.map(
        (picture) =>
          `<Relationship Id="${picture.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${picture.name}"/>`,
      ),
    )
    .join('');

  const media = {};
  for (const picture of pictures) media[`word/${picture.name}`] = picture.data;

  return writeZip({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  ${relations}
</Relationships>`,
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${escapeXml(options.title ?? 'Document')}</dc:title>
  <dc:creator>${escapeXml(options.author ?? '')}</dc:creator>
</cp:coreProperties>`,
    'word/styles.xml': STYLES,
    'word/numbering.xml': NUMBERING,
    'word/document.xml': document,
    ...media,
  });
}

const textOf = (node) =>
  [...node.getElementsByTagNameNS('*', 't')].map((entry) => entry.textContent).join('');

export function docxToHtml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('That document could not be read');

  const out = [];
  let list = null;
  const closeList = () => {
    if (list) out.push(list === 'ol' ? '</ol>' : '</ul>');
    list = null;
  };

  const body = doc.getElementsByTagNameNS('*', 'body')[0];
  if (!body) return '';

  for (const node of body.children) {
    const local = node.localName;

    if (local === 'tbl') {
      closeList();
      const rows = [...node.getElementsByTagNameNS('*', 'tr')]
        .map((row) => {
          const cells = [...row.getElementsByTagNameNS('*', 'tc')]
            .map((cell) => `<td>${escapeXml(textOf(cell))}</td>`)
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      out.push(`<table>${rows}</table>`);
      continue;
    }

    if (local !== 'p') continue;

    const style = node.getElementsByTagNameNS('*', 'pStyle')[0]?.getAttribute('w:val') ?? '';
    const numbered = node.getElementsByTagNameNS('*', 'numPr').length > 0;
    const numId = node.getElementsByTagNameNS('*', 'numId')[0]?.getAttribute('w:val');

    const runs = [...node.getElementsByTagNameNS('*', 'r')]
      .map((run) => {
        const props = run.getElementsByTagNameNS('*', 'rPr')[0];
        let piece = escapeXml(textOf(run));
        if (!piece) return '';
        if (props) {
          if (props.getElementsByTagNameNS('*', 'b').length) piece = `<b>${piece}</b>`;
          if (props.getElementsByTagNameNS('*', 'i').length) piece = `<i>${piece}</i>`;
          if (props.getElementsByTagNameNS('*', 'u').length) piece = `<u>${piece}</u>`;
          if (props.getElementsByTagNameNS('*', 'strike').length) piece = `<s>${piece}</s>`;
        }
        return piece;
      })
      .join('');

    if (numbered) {
      const want = numId === '2' ? 'ol' : 'ul';
      if (list !== want) {
        closeList();
        out.push(want === 'ol' ? '<ol>' : '<ul>');
        list = want;
      }
      out.push(`<li>${runs || '<br>'}</li>`);
      continue;
    }
    closeList();

    const heading = /^Heading([1-6])$/.exec(style);
    if (heading) {
      out.push(`<h${heading[1]}>${runs || '<br>'}</h${heading[1]}>`);
      continue;
    }
    if (style === 'Quote') {
      out.push(`<blockquote>${runs || '<br>'}</blockquote>`);
      continue;
    }
    if (style === 'Code') {
      out.push(`<pre>${runs || '<br>'}</pre>`);
      continue;
    }
    out.push(`<p>${runs || '<br>'}</p>`);
  }
  closeList();
  return out.join('\n');
}
