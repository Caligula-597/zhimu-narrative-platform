from __future__ import annotations

import argparse
from pathlib import Path

import pypdfium2 as pdfium


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("output_dir")
    parser.add_argument("--scale", type=float, default=2.0)
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    pdf = pdfium.PdfDocument(str(pdf_path))
    for index in range(len(pdf)):
        page = pdf[index]
        bitmap = page.render(scale=args.scale, rotation=0)
        image = bitmap.to_pil()
        image.save(output_dir / f"page-{index + 1:03d}.png")
        page.close()
    print(f"{pdf_path.name}: {len(pdf)} pages")


if __name__ == "__main__":
    main()
