ALTER TABLE "topic_read_state" DROP CONSTRAINT "topic_read_state_last_read_post_fkey";
--> statement-breakpoint
DROP INDEX "topic_read_state_last_read_post_id_idx";--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_place_id_topic_id_id_unique" UNIQUE("place_id","topic_id","id");--> statement-breakpoint
ALTER TABLE "topic_read_state" ADD CONSTRAINT "topic_read_state_last_read_post_fkey" FOREIGN KEY ("place_id","topic_id","last_read_post_id") REFERENCES "public"."posts"("place_id","topic_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topic_read_state_place_topic_last_read_post_idx" ON "topic_read_state" USING btree ("place_id","topic_id","last_read_post_id");