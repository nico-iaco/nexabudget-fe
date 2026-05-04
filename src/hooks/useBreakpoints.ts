import { useMediaQuery } from './useMediaQuery';

export const useBreakpoints = () => {
    // 991px matches AntD's 'lg' breakpoint (Sider breakpoint="lg")
    const isMobile = useMediaQuery('(max-width: 991px)');
    const isSmallMobile = useMediaQuery('(max-width: 768px)');
    return { isMobile, isSmallMobile };
};
