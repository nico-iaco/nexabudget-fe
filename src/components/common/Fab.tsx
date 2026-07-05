import type { ReactNode } from 'react';
import { Button, theme } from 'antd';

interface FabProps {
    icon: ReactNode;
    onClick: () => void;
    'aria-label': string;
}

/**
 * Floating action button mobile — come da mockup (52px, ancorato sopra la
 * bottom nav bar). Usare solo su pagine con una singola azione di creazione
 * inequivocabile (es. Budget); su pagine con più azioni primarie preferire
 * i bottoni nel PageHeader per evitare ambiguità sull'azione del FAB.
 */
export const Fab = ({ icon, onClick, 'aria-label': ariaLabel }: FabProps) => {
    const { token } = theme.useToken();
    return (
        <Button
            type="primary"
            shape="circle"
            icon={icon}
            onClick={onClick}
            aria-label={ariaLabel}
            style={{
                position: 'fixed',
                bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 22px)',
                right: 22,
                width: 52,
                height: 52,
                fontSize: 20,
                zIndex: 998,
                boxShadow: `0 8px 20px ${token.colorPrimaryBorder}`,
            }}
        />
    );
};
