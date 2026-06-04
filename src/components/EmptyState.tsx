import type { ReactNode } from 'react';
import { Button, Empty, Flex, Space } from 'antd';

interface EmptyStateAction {
    label: string;
    onClick: () => void;
    /** Se true rende il bottone primary; il primo action è sempre primary per default */
    type?: 'primary' | 'default';
    icon?: ReactNode;
}

interface EmptyStateProps {
    description: string;
    image?: ReactNode;
    actions?: EmptyStateAction[];
    style?: React.CSSProperties;
}

/**
 * Empty state riutilizzabile con supporto per call-to-action.
 * Sostituisce gli <Empty> solo-testo in tutta l'app.
 */
export const EmptyState = ({ description, image, actions = [], style }: EmptyStateProps) => {
    return (
        <Empty
            image={image ?? Empty.PRESENTED_IMAGE_SIMPLE}
            description={description}
            style={{ marginTop: 48, ...style }}
        >
            {actions.length > 0 && (
                <Flex justify="center">
                    <Space wrap>
                        {actions.map((action, idx) => (
                            <Button
                                key={action.label}
                                type={action.type ?? (idx === 0 ? 'primary' : 'default')}
                                icon={action.icon}
                                onClick={action.onClick}
                            >
                                {action.label}
                            </Button>
                        ))}
                    </Space>
                </Flex>
            )}
        </Empty>
    );
};
