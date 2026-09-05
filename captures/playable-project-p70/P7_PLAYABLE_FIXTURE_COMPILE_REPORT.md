# P7 Playable Fixture Compile Report

> Fixture: `fixture-warehouse-six-v1` rev `1.0.0`

## Gate

| 检查 | 结果 |
|---|---|
| status READY | PASS |
| 0 ERROR | PASS |
| 6 players + 1 host | PASS |
| source fidelity (no rewrite) | PASS |
| M03 placement | PASS |
| M09 placement | PASS |

## Counts

| 项 | 值 |
|---|---:|
| roles | 7 |
| stages | 4 |
| contentUnits | 37 |
| clues | 3 |
| mechanismPlacements | 2 |
| permissions | 1 |
| ERROR | 0 |
| WARN | 0 |

## Roles

- `role_host` 主持人 (HOST)
- `role_a` 沈孤鸿 (PLAYER)
- `role_b` 陆晚晴 (PLAYER)
- `role_c` 赵启明 (PLAYER)
- `role_d` 白素 (PLAYER)
- `role_e` 周衡 (PLAYER)
- `role_f` 方砚 (PLAYER)

## Stages

- **第一幕·报案** (`stage_1`) content=10 clues=1 mechs=—
- **第二幕·库房争夺** (`stage_2`) content=11 clues=1 mechs=place_m03_storage
- **第三幕·账册余烬** (`stage_3`) content=8 clues=1 mechs=—
- **第四幕·投票结算** (`stage_4`) content=8 clues=0 mechs=place_m09_final

## Mechanisms

- **库房进入资格竞价** M03-1 @ stage_2 · bindings=1
- **最终指凶投票** M09-1 @ stage_4 · bindings=1

## Diagnostics

_none_

## Source fidelity

_all content units match fixture paragraphs_

生成时间：2026-09-05T03:41:38.682Z
