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
    """计算中文字符占比"""
    if not text:
        return 0.0
    cn_count = sum(1 for ch in text if CJK_RE.search(ch))
    meaningful = sum(1 for ch in text if ch.isalnum() or CJK_RE.search(ch))
    if meaningful == 0:
        return 0.0
    return cn_count / meaningful
