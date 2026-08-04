from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


QA = Path(r"D:\长剧情\软著材料\渲染检查\2026-07-26_织幕V1.0")
BATCH = 5


def ink_bbox(image: Image.Image):
    rgb = image.convert("RGB")
    white = Image.new("RGB", rgb.size, (250, 250, 250))
    diff = ImageChops.difference(rgb, white).convert("L")
    mask = diff.point(lambda value: 255 if value > 12 else 0)
    return mask.getbbox()


def main() -> None:
    report = {}
    for document_dir in sorted(path for path in QA.iterdir() if path.is_dir()):
        pages = sorted(document_dir.glob("page-*.png"))
        page_report = []
        sheets_dir = document_dir / "contact-sheets"
        sheets_dir.mkdir(exist_ok=True)

        for page_path in pages:
            with Image.open(page_path) as image:
                bbox = ink_bbox(image)
                width, height = image.size
                page_report.append({
                    "page": page_path.name,
                    "width": width,
                    "height": height,
                    "ink_bbox": bbox,
                    "blank": bbox is None,
                    "touches_edge": bool(
                        bbox
                        and (
                            bbox[0] <= 2
                            or bbox[1] <= 2
                            or bbox[2] >= width - 2
                            or bbox[3] >= height - 2
                        )
                    ),
                })

        for batch_index in range(0, len(pages), BATCH):
            batch = pages[batch_index:batch_index + BATCH]
            loaded = [Image.open(page).convert("RGB") for page in batch]
            try:
                max_width = max(image.width for image in loaded)
                label_height = 34
                total_height = sum(image.height + label_height for image in loaded)
                sheet = Image.new("RGB", (max_width, total_height), "white")
                draw = ImageDraw.Draw(sheet)
                y = 0
                for local_index, image in enumerate(loaded):
                    page_number = batch_index + local_index + 1
                    draw.rectangle((0, y, max_width, y + label_height), fill="#203748")
                    draw.text((12, y + 8), f"Page {page_number}", fill="white")
                    y += label_height
                    sheet.paste(image, (0, y))
                    y += image.height
                sheet.save(
                    sheets_dir / f"pages-{batch_index + 1:03d}-{batch_index + len(batch):03d}.jpg",
                    quality=90,
                    optimize=True,
                )
            finally:
                for image in loaded:
                    image.close()

        report[document_dir.name] = {
            "page_count": len(pages),
            "blank_pages": [row["page"] for row in page_report if row["blank"]],
            "edge_pages": [row["page"] for row in page_report if row["touches_edge"]],
            "pages": page_report,
        }

    report_path = QA / "render-inspection.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        name: {
            "page_count": value["page_count"],
            "blank_pages": value["blank_pages"],
            "edge_pages": value["edge_pages"],
        }
        for name, value in report.items()
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
