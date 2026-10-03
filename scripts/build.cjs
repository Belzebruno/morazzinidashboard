const fs = require('node:fs');
const layout = fs.readFileSync('src/layout.html','utf8');
fs.mkdirSync('dist', { recursive: true });
for (const [file,page,title] of [['index.html','opening','Abertura'],['patrimonio.html','patrimony','Patrimônio'],['financeiro.html','finance','Financeiro']]) {
  let html = layout.replace('{{page}}',page).replace('<title>Plano de Abertura | Morazzini</title>',`<title>${title} | Morazzini</title>`);
  html = html.replace('{{title}}',title).replace(`class="nav-item" href="${file}"`, `class="nav-item active" href="${file}" aria-current="page"`);
  for (const partial of ['summary','items','finance']) html = html.replace(`{{${partial}}}`,fs.readFileSync(`src/partials/${partial}.html`,'utf8'));
  fs.writeFileSync(file,html);
  fs.writeFileSync(`dist/${file}`,html);
}
for (const dir of ['assets', 'Logo']) fs.cpSync(dir, `dist/${dir}`, { recursive: true });
