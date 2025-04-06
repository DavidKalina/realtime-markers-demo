import { ANIMATION_CONSTANTS } from "./gravitationalCameraConfig";

export const createPanningHandlers = (
    isUserPanningRef: React.MutableRefObject<boolean>,
    panningTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    viewportSamplesRef: React.MutableRefObject<any[]>
) => {
    const handlePanningStart = () => {
        isUserPanningRef.current = true;

        if (panningTimeoutRef.current) {
            clearTimeout(panningTimeoutRef.current);
        }
    };

    const handlePanningEnd = () => {
        if (panningTimeoutRef.current) {
            clearTimeout(panningTimeoutRef.current);
        }

        panningTimeoutRef.current = setTimeout(() => {
            isUserPanningRef.current = false;
            viewportSamplesRef.current = [];
        }, ANIMATION_CONSTANTS.PANNING_TIMEOUT);
    };

    return { handlePanningStart, handlePanningEnd };
};

export const createZoomingHandlers = (
    isUserZoomingRef: React.MutableRefObject<boolean>,
    zoomingTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
) => {
    const handleZoomingStart = () => {
        isUserZoomingRef.current = true;

        if (zoomingTimeoutRef.current) {
            clearTimeout(zoomingTimeoutRef.current);
        }
    };

    const handleZoomingEnd = () => {
        if (zoomingTimeoutRef.current) {
            clearTimeout(zoomingTimeoutRef.current);
        }

        zoomingTimeoutRef.current = setTimeout(() => {
            isUserZoomingRef.current = false;
        }, ANIMATION_CONSTANTS.ZOOMING_TIMEOUT);
    };

    return { handleZoomingStart, handleZoomingEnd };
}; 