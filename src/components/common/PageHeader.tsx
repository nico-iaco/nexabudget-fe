import type { ReactNode } from 'react';
import { Flex, Typography } from 'antd';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { PAGE_HEADER_MARGIN_BOTTOM } from '../../theme/tokens';

const { Title } = Typography;

interface PageHeaderProps {
    title: ReactNode;
    actions?: ReactNode;
}

export const PageHeader = ({ title, actions }: PageHeaderProps) => {
    const { isSmallMobile } = useBreakpoints();
    return (
        <Flex
            justify="space-between"
            align={isSmallMobile ? 'flex-start' : 'center'}
            wrap="wrap"
            gap="small"
            vertical={isSmallMobile && !!actions}
            style={{ marginBottom: PAGE_HEADER_MARGIN_BOTTOM }}
        >
            <Title
                level={2}
                style={{
                    margin: 0,
                    fontSize: isSmallMobile ? '1.5rem' : '2rem',
                    lineHeight: 1.2,
                }}
            >
                {title}
            </Title>
            {actions && (
                <div style={{ width: isSmallMobile ? '100%' : 'auto' }}>
                    {actions}
                </div>
            )}
        </Flex>
    );
};
