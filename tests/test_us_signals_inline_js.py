"""Regression checks for the US signals lab inline JavaScript and HTML tail."""
from pathlib import Path
import re
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "world-intelligence" / "us-signals.html"


class USSignalsInlineScriptTest(unittest.TestCase):
    def test_balanced_script_tags_and_single_html_close(self):
        html = HTML.read_text(encoding="utf-8")
        self.assertEqual(len(re.findall(r"<script\b", html, re.I)),
                         len(re.findall(r"</script\s*>", html, re.I)))
        self.assertEqual(len(re.findall(r"</html\s*>", html, re.I)), 1)
        self.assertTrue(html.rstrip().lower().endswith("</html>"))

    def test_all_inline_scripts_parse(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("Node.js is required for inline JavaScript syntax checking")
        html = HTML.read_text(encoding="utf-8")
        scripts = re.findall(r"<script\b([^>]*)>(.*?)</script\s*>",
                             html, re.I | re.S)
        checked = 0
        for attrs, code in scripts:
            if re.search(r"\bsrc\s*=", attrs, re.I) or not code.strip():
                continue
            result = subprocess.run([node, "--check"], input=code,
                                    text=True, capture_output=True, check=False)
            self.assertEqual(result.returncode, 0,
                             f"Inline script {checked} has invalid JS: {result.stderr}")
            checked += 1
        self.assertGreaterEqual(checked, 5)


    def test_public_ptr_archive_contract(self):
        """The Pages archive must load the published public file and fail closed."""
        node = shutil.which("node")
        if not node:
            self.skipTest("Node.js is required for the archive contract test")
        html = HTML.read_text(encoding="utf-8")
        scripts = re.findall(r"<script\b([^>]*)>(.*?)</script\s*>", html, re.I | re.S)
        archive = next(code for attrs, code in scripts if "loadHouseTrades" in code and not re.search(r"\bsrc\s*=", attrs, re.I))
        harness = r"""
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(0,'utf8');
function makeElement(){
  return {value:'',disabled:true,style:{},children:[],events:{},
    addEventListener(name,fn){this.events[name]=fn;},
    replaceChildren(){this.children=[];},
    append(...nodes){this.children.push(...nodes);},
    prepend(...nodes){this.children.unshift(...nodes);},
    setAttribute(){},textContent:''};
}
async function scenario(payload,httpOK=true){
  const elements={};
  const document={
    getElementById(id){return elements[id]??=(makeElement());},
    createElement(){return makeElement();}
  };
  let url='';
  const fetch=async(u)=>{url=u;return {ok:httpOK,status:404,json:async()=>payload};};
  vm.runInNewContext(source,{document,fetch});
  await elements.loadHouseTrades.events.click();
  return {url,status:elements.houseTradeStatus.textContent,
          children:elements.houseTradeList.children.length,
          retry:!elements.loadHouseTrades.disabled};
}
(async()=>{
  const valid=await scenario({updated:'2026-11-04',trades:[
    {who:'Example',d:'2025-01-01',asset:'ABC',tk:'ABC',ty:'P',amt:'$1,001–$15,000',filed:'2025-02-01'}
  ]});
  if(!valid.url.endsWith('/data/us/trades_public.json')||
     !valid.status.includes('검색 결과 1건')||
     !valid.status.includes('원문 대조 상태 미확인')||
     valid.children!==1)throw Error('valid public PTR contract failed '+JSON.stringify(valid));
  const empty=await scenario({updated:'2026-11-04',trades:[]});
  if(!empty.status.includes('실제 거래 0건 아님')||!empty.retry)
    throw Error('valid empty data not distinguished '+JSON.stringify(empty));
  const malformed=await scenario({});
  if(!malformed.status.includes('데이터 로딩 실패')||!malformed.retry)
    throw Error('malformed schema falsely accepted '+JSON.stringify(malformed));
  const failed=await scenario({},false);
  if(!failed.status.includes('HTTP 404')||!failed.retry)
    throw Error('HTTP error falsely accepted '+JSON.stringify(failed));
})().catch(e=>{console.error(e);process.exitCode=1;});
"""
        result = subprocess.run([node, "-e", harness], input=archive,
                                text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
