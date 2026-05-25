"""编码检测与中文占比计算"""

from ..utils import CJK_RE


def _detect_encoding(raw: bytes) -> str:
    """检测文本编码"""
    try:
        raw.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        pass

    for enc in ("gbk", "gb2312", "big5", "shift_jis", "euc-kr"):
        try:
            raw.decode(enc)
            return enc
        except (UnicodeDecodeError, LookupError):
            continue

    return "unknown"


def _calc_cn_ratio(text: str) -> float:
    """计算中文字符占比（单次遍历）"""
    if not text:
        return 0.0
    cn_count = 0
    meaningful = 0
    for ch in text:
        is_cjk = bool(CJK_RE.search(ch))
        if is_cjk:
            cn_count += 1
            meaningful += 1
        elif ch.isalnum():
            meaningful += 1
    if meaningful == 0:
        return 0.0
    return cn_count / meaningful
