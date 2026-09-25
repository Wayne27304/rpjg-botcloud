import React, { createContext, useContext, useState, useEffect } from 'react';

const ReadOnlyContext = createContext(false);

export const useReadOnly = () => useContext(ReadOnlyContext);

export const ReadOnlyProvider = ({ children }) => {
    const [readOnly, setReadOnly] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/status/read-only')
            .then(res => res.json())
            .then(data => {
                setReadOnly(data.readOnly);
                setLoading(false);
            })
            .catch(error => {
                console.error("Failed to fetch read-only status:", error);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div>Loading application...</div>;
    }

    return (
        <ReadOnlyContext.Provider value={readOnly}>
            {children}
        </ReadOnlyContext.Provider>
    );
};