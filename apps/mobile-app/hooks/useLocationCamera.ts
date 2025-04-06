import { useCallback, useEffect, useRef } from "react";
import { Camera } from "@rnmapbox/maps";
import { createCameraSettings } from "@/config/cameraConfig";

interface UseLocationCameraProps {
    userLocation: [number, number] | null;
    isLoadingLocation: boolean;
    isMapReady: boolean;
    cameraRef: React.RefObject<Camera>;
    isUserInteracting: boolean;
}

export const useLocationCamera = ({
    userLocation,
    isLoadingLocation,
    isMapReady,
    cameraRef,
    isUserInteracting,
}: UseLocationCameraProps) => {
    // Track if we've done initial centering
    const hasCenteredOnUserRef = useRef(false);
    // Track the last time we updated the camera
    const lastUpdateTimeRef = useRef<number>(0);
    // Minimum time between camera updates (in ms)
    const UPDATE_COOLDOWN = 2000;

    const updateCamera = useCallback(() => {
        if (!userLocation || !cameraRef.current) return;

        const now = Date.now();
        // Only update if enough time has passed since last update
        if (now - lastUpdateTimeRef.current < UPDATE_COOLDOWN) return;

        lastUpdateTimeRef.current = now;
        cameraRef.current.setCamera(createCameraSettings(userLocation));
    }, [userLocation, cameraRef]);

    // Handle initial centering
    useEffect(() => {
        if (
            userLocation &&
            !isLoadingLocation &&
            isMapReady &&
            cameraRef.current &&
            !hasCenteredOnUserRef.current &&
            !isUserInteracting
        ) {
            hasCenteredOnUserRef.current = true;
            updateCamera();
        }
    }, [userLocation, isLoadingLocation, isMapReady, cameraRef, isUserInteracting, updateCamera]);

    // Handle subsequent location updates
    useEffect(() => {
        if (
            userLocation &&
            !isLoadingLocation &&
            isMapReady &&
            cameraRef.current &&
            hasCenteredOnUserRef.current &&
            !isUserInteracting
        ) {
            updateCamera();
        }
    }, [userLocation, isLoadingLocation, isMapReady, cameraRef, isUserInteracting, updateCamera]);

    return {};
}; 