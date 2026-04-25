DROP TRIGGER IF EXISTS on_file_insert_analyze ON public.files;
DROP TRIGGER IF EXISTS dispatch_file_analysis ON public.files;
DROP FUNCTION IF EXISTS public.dispatch_file_analysis();