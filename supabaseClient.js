// Supabase 연결 설정
// anon/publishable key는 공개되어도 되는 키이므로 클라이언트 코드에 그대로 둡니다.
const SUPABASE_URL = 'https://reawosbtamhyeqorngfw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LpdXiBEfI2_1HqCM2O4z0A_x6XGef9V';

// index.html에서 CDN(UMD 번들, https://unpkg.com/@supabase/supabase-js@2)을 먼저 로드하면
// 전역 `supabase` 객체(createClient 포함)가 생성됩니다.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
