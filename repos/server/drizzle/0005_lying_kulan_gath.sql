CREATE TABLE "topic_view_flushes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"topic_id" uuid NOT NULL,
	"count" integer NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_view_flushes_count_check" CHECK ("topic_view_flushes"."count" > 0)
);
--> statement-breakpoint
ALTER TABLE "topic_view_flushes" ADD CONSTRAINT "topic_view_flushes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topic_view_flushes_topic_id_processed_at_idx" ON "topic_view_flushes" USING btree ("topic_id","processed_at");--> statement-breakpoint
CREATE INDEX "topic_follows_user_id_topic_id_idx" ON "topic_follows" USING btree ("user_id","topic_id");--> statement-breakpoint
CREATE INDEX "topics_place_latest_feed_idx" ON "topics" USING btree ("place_id","is_pinned","latest_post_at","id") WHERE "topics"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "topics_forum_latest_feed_idx" ON "topics" USING btree ("forum_id","is_pinned","latest_post_at","id") WHERE "topics"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "topics_place_popular_feed_idx" ON "topics" USING btree ("place_id","reply_count","latest_post_at","id") WHERE "topics"."deleted_at" is null;