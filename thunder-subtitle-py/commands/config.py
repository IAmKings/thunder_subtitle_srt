"""config 命令：配置管理"""

from src.config import Config
from src.ui import DIM, GREEN, RED, RESET


def cmd_config(args) -> None:
    """配置管理"""
    config = Config.load()

    if args.reset:
        config = Config()
        config.save()
        print(f"{GREEN}\n  ✓ Config reset to defaults{RESET}\n")
        return

    if args.set_pair:
        key, value = args.set_pair[0], args.set_pair[1]
        if not hasattr(config, key):
            valid = ", ".join(Config.__dataclass_fields__.keys())
            print(f"{RED}\n  ✗ Unknown key: {key}{RESET}")
            print(f"{DIM}  Valid keys: {valid}{RESET}\n")
            return
        current = getattr(config, key)
        if isinstance(current, int):
            try:
                setattr(config, key, int(value))
            except ValueError:
                print(f"{RED}\n  ✗ Invalid integer value: {value}{RESET}\n")
                return
        else:
            setattr(config, key, value)
        config.save()
        print(f"{GREEN}\n  ✓ {key} = {getattr(config, key)}{RESET}\n")
        return

    config.show()
