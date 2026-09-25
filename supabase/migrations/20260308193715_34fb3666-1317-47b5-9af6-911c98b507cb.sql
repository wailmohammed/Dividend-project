-- Allow admins to update any community post
CREATE POLICY "Admins can update any post"
ON public.community_posts
FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Allow admins to delete any community post
CREATE POLICY "Admins can delete any post"
ON public.community_posts
FOR DELETE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));