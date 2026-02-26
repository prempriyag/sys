"""
Visual debug: draw detected boxes on page images (e.g. for OCR layout verification).
Output: debug/page_1_boxes.jpg, page_2_boxes.jpg
Enable via config: VISUAL_DEBUG=True
"""
import logging
from pathlib import Path
from typing import List, Tuple, Union

logger = logging.getLogger(__name__)


def draw_boxes(
    image: Union[Path, str, "Any"],
    boxes: List[Tuple[int, int, int, int]],
    output_path: Union[Path, str],
    color: Tuple[int, int, int] = (0, 255, 0),
    thickness: int = 2,
) -> bool:
    """
    Draw rectangles on image for each (x, y, w, h) in boxes. Save to output_path.
    Returns True if saved successfully.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        logger.warning("OpenCV (cv2) not installed; visual debug skipped")
        return False

    if isinstance(image, (Path, str)):
        img = cv2.imread(str(image))
    else:
        try:
            img = np.array(image)
            if len(img.shape) == 2:
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        except Exception:
            logger.warning("Could not convert image for draw_boxes")
            return False

    if img is None:
        logger.warning("Could not load image for draw_boxes: %s", image)
        return False

    for box in boxes:
        if len(box) >= 4:
            x, y, w, h = int(box[0]), int(box[1]), int(box[2]), int(box[3])
            cv2.rectangle(img, (x, y), (x + w, y + h), color, thickness)

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out), img)
    logger.info("Wrote visual debug: %s", out)
    return True
