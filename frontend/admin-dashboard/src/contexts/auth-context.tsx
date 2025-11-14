import React, { createContext, useContext, useState, useEffect } from "react";
import { authService, type User, type LoginRequest } from "@/services/auth.service";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is logged in from localStorage
        const savedUser = authService.getUser();
        if (savedUser) {
            setUser(savedUser);
            // Validate token bằng cách gọi API
            authService.getProfile()
                .then(response => {
                    setUser(response.data);
                })
                .catch(() => {
                    // Token không hợp lệ, xóa đi
                    authService.logout();
                    setUser(null);
                });
        }
        setLoading(false);
    }, []);

    const login = async (email: string, password: string) => {
        const data: LoginRequest = { email, password };
        const response = await authService.loginSystemAdmin(data);
        setUser(response.data.user);
        authService.saveAuthData(response.data.token, response.data.user);
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

