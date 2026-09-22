CREATE INDEX "chat_message_revisions_place_message_idx" ON "chat_message_revisions" USING btree ("place_id","message_id");--> statement-breakpoint
CREATE INDEX "chat_message_revisions_editor_user_id_idx" ON "chat_message_revisions" USING btree ("editor_user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_place_channel_idx" ON "chat_messages" USING btree ("place_id","channel_id");--> statement-breakpoint
CREATE INDEX "chat_messages_deleted_by_user_id_idx" ON "chat_messages" USING btree ("deleted_by_user_id");--> statement-breakpoint
CREATE INDEX "chat_read_state_place_message_idx" ON "chat_read_state" USING btree ("place_id","last_read_message_id");--> statement-breakpoint
CREATE INDEX "notifications_place_id_idx" ON "notifications" USING btree ("place_id");