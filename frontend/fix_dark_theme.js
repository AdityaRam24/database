const fs = require('fs');
const path = require('path');

const aiPath = path.join(__dirname, 'src/app/dashboard/ai/page.tsx');
let aiCode = fs.readFileSync(aiPath, 'utf8');

aiCode = aiCode.replace(
  /{ttsEnabled \? 'bg-violet-100 text-violet-700 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}/g,
  `{ttsEnabled ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 shadow-sm' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08]'}`
);

aiCode = aiCode.replace(
  /text-slate-400 hover:text-rose-500 hover:bg-rose-50 /g,
  `text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 `
);

aiCode = aiCode.replace(
  /text-left px-4 py-4 rounded-2xl border border-slate-200 dark:border-white\/\[0\.08\] bg-white dark:bg-white\/\[0\.05\] hover:border-violet-300 dark:hover:border-violet-400 hover:shadow-md transition-all cursor-pointer group/g,
  `text-left px-4 py-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.05] hover:border-violet-300 dark:hover:border-violet-400 hover:shadow-md transition-all cursor-pointer group`
);

aiCode = aiCode.replace(
  /text-\[10px\] font-black uppercase tracking-widest \$\{msg.role === 'user' \? 'text-right text-slate-400' : 'text-violet-500'\}/g,
  `text-[10px] font-black uppercase tracking-widest \${msg.role === 'user' ? 'text-right text-slate-400' : 'text-violet-500 dark:text-violet-400'}`
);

aiCode = aiCode.replace(
  /bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-600 hover:shadow-md/g,
  `bg-slate-100 dark:bg-white/[0.08] text-slate-500 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-violet-500/20 hover:text-violet-600 dark:hover:text-violet-400 hover:shadow-md`
);

// One of the targets was:
// text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all
aiCode = aiCode.replace(
  /text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all/g,
  `text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all`
);

fs.writeFileSync(aiPath, aiCode);
console.log('AI page updated part 2');
