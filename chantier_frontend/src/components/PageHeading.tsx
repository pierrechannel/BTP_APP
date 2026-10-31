import { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

export function PageHeading({ eyebrow, title, subtitle }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode }) {
  return <Box sx={{ minWidth: 0 }}>
    <Stack direction="row" gap={1.5} alignItems="baseline" flexWrap="wrap">
      {eyebrow && <Typography variant="overline" color="primary.main" sx={{ fontSize: 10, lineHeight: 1.4 }}>{eyebrow}</Typography>}
      <Typography component="h1" fontSize={{ xs: 20, sm: 22 }} fontWeight={750} lineHeight={1.3} sx={{ overflowWrap: 'anywhere' }}>{title}</Typography>
    </Stack>
    {subtitle && <Typography fontSize={12} color="text.secondary" mt={.5}>{subtitle}</Typography>}
  </Box>;
}
