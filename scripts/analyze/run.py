"""임시 폴더에 만들고 → 검사 통과 시에만 data/answers 를 교체. 실패하면 기존 결과를 그대로 둔다(배포 안 함)."""
import os, shutil, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import D
import build, verify

if __name__ == "__main__":
    tmp = tempfile.mkdtemp(prefix="answers-")
    build.main(tmp)
    errs, n = verify.check(tmp)
    if errs:
        for e in errs[:50]:
            print("FAIL", e)
        print("검사 실패 %d건 — data/answers 를 갱신하지 않음" % len(errs))
        sys.exit(1)
    dst = os.path.join(D, "answers")
    shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(tmp, dst)
    print("검사 통과 %d종목 → %s" % (n, dst))
