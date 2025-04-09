import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useJobSessionStore } from "@/stores/useJobSessionStore";

export function JobSessionInitializer() {
    const { user } = useAuth();
    const { setClientId, connect } = useJobSessionStore();

    useEffect(() => {
        if (user?.id) {
            setClientId(user.id);
            connect();
        }
    }, [user?.id, setClientId, connect]);

    return null;
} 