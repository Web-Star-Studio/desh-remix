CREATE TRIGGER dispatch_file_analysis
  AFTER INSERT ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_file_analysis();