#!/usr/bin/env python3
"""
ClickUp API Client — CLI + importable module.

Usage (CLI):
    python clickup_client.py <command> [key=value ...]

Auth:
    Set CLICKUP_API_TOKEN environment variable.
    Get token: ClickUp Settings → Apps → Generate API Token

API reference: https://clickup.com/api
"""

import json
import os
import sys
import time
from collections import defaultdict
from typing import Any, Optional
from urllib import request, error
from urllib.parse import urlencode


BASE_V2 = "https://api.clickup.com/api/v2"
BASE_V3 = "https://api.clickup.com/api/v3"
RATE_LIMIT_PAUSE = 0.7  # seconds between paginated requests


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _token() -> str:
    token = os.environ.get("CLICKUP_API_TOKEN", "")
    if not token:
        sys.exit("ERROR: CLICKUP_API_TOKEN environment variable not set.")
    return token


def _headers(json_body: bool = False) -> dict:
    h = {"Authorization": _token()}
    if json_body:
        h["Content-Type"] = "application/json"
    return h


def _request(method: str, url: str, body: Optional[dict] = None, params: Optional[dict] = None) -> Any:
    if params:
        url = f"{url}?{urlencode(params, doseq=True)}"
    data = json.dumps(body).encode() if body is not None else None
    req = request.Request(url, data=data, headers=_headers(json_body=body is not None), method=method)
    try:
        with request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except error.HTTPError as e:
        body_text = e.read().decode(errors="replace")
        sys.exit(f"HTTP {e.code} {e.reason} — {body_text}")


def _get(url: str, params: Optional[dict] = None) -> Any:
    return _request("GET", url, params=params)


def _post(url: str, body: dict) -> Any:
    return _request("POST", url, body=body)


def _put(url: str, body: dict) -> Any:
    return _request("PUT", url, body=body)


def _delete(url: str, params: Optional[dict] = None) -> Any:
    return _request("DELETE", url, params=params)


# ---------------------------------------------------------------------------
# ClickUpClient
# ---------------------------------------------------------------------------

class ClickUpClient:
    """Importable client. All methods return parsed JSON dicts/lists."""

    # ------------------------------------------------------------------
    # Workspaces
    # ------------------------------------------------------------------

    def get_teams(self) -> list:
        """Return all accessible workspaces (teams)."""
        return _get(f"{BASE_V2}/team").get("teams", [])

    # ------------------------------------------------------------------
    # Spaces
    # ------------------------------------------------------------------

    def get_spaces(self, team_id: str, archived: bool = False) -> list:
        params = {"archived": str(archived).lower()}
        return _get(f"{BASE_V2}/team/{team_id}/space", params).get("spaces", [])

    def get_space(self, space_id: str) -> dict:
        return _get(f"{BASE_V2}/space/{space_id}")

    def create_space(self, team_id: str, name: str, **kwargs) -> dict:
        body = {"name": name, **kwargs}
        return _post(f"{BASE_V2}/team/{team_id}/space", body)

    def update_space(self, space_id: str, **kwargs) -> dict:
        return _put(f"{BASE_V2}/space/{space_id}", kwargs)

    # ------------------------------------------------------------------
    # Folders
    # ------------------------------------------------------------------

    def get_folders(self, space_id: str, archived: bool = False) -> list:
        params = {"archived": str(archived).lower()}
        return _get(f"{BASE_V2}/space/{space_id}/folder", params).get("folders", [])

    def get_folder(self, folder_id: str) -> dict:
        return _get(f"{BASE_V2}/folder/{folder_id}")

    def create_folder(self, space_id: str, name: str) -> dict:
        return _post(f"{BASE_V2}/space/{space_id}/folder", {"name": name})

    def update_folder(self, folder_id: str, name: str) -> dict:
        return _put(f"{BASE_V2}/folder/{folder_id}", {"name": name})

    # ------------------------------------------------------------------
    # Lists
    # ------------------------------------------------------------------

    def get_lists(self, folder_id: str, archived: bool = False) -> list:
        params = {"archived": str(archived).lower()}
        return _get(f"{BASE_V2}/folder/{folder_id}/list", params).get("lists", [])

    def get_space_lists(self, space_id: str, archived: bool = False) -> list:
        """Folderless lists inside a space."""
        params = {"archived": str(archived).lower()}
        return _get(f"{BASE_V2}/space/{space_id}/list", params).get("lists", [])

    def get_list(self, list_id: str) -> dict:
        return _get(f"{BASE_V2}/list/{list_id}")

    def create_list(self, folder_id: str, name: str, **kwargs) -> dict:
        body = {"name": name, **kwargs}
        return _post(f"{BASE_V2}/folder/{folder_id}/list", body)

    def create_space_list(self, space_id: str, name: str, **kwargs) -> dict:
        body = {"name": name, **kwargs}
        return _post(f"{BASE_V2}/space/{space_id}/list", body)

    def update_list(self, list_id: str, **kwargs) -> dict:
        return _put(f"{BASE_V2}/list/{list_id}", kwargs)

    def get_list_fields(self, list_id: str) -> list:
        return _get(f"{BASE_V2}/list/{list_id}/field").get("fields", [])

    # ------------------------------------------------------------------
    # Tasks
    # ------------------------------------------------------------------

    def get_task(self, task_id: str, custom_task_ids: bool = False, team_id: Optional[str] = None) -> dict:
        params: dict = {}
        if custom_task_ids:
            params["custom_task_ids"] = "true"
            params["team_id"] = team_id
        return _get(f"{BASE_V2}/task/{task_id}", params or None)

    def get_tasks(self, list_id: str, **filters) -> list:
        """
        Filters: page, order_by, reverse, subtasks, statuses, include_closed,
                 assignees, due_date_gt, due_date_lt, date_created_gt,
                 date_created_lt, date_updated_gt, date_updated_lt
        """
        params = {k: v for k, v in filters.items()}
        params.setdefault("subtasks", "true")
        return _get(f"{BASE_V2}/list/{list_id}/task", params).get("tasks", [])

    def create_task(self, list_id: str, name: str, **kwargs) -> dict:
        """
        Optional kwargs: description, assignees, tags, status, priority,
                         due_date (ms), due_date_time, time_estimate (ms),
                         start_date (ms), start_date_time, notify_all,
                         parent, links_to, custom_fields
        """
        body = {"name": name, **kwargs}
        return _post(f"{BASE_V2}/list/{list_id}/task", body)

    def update_task(self, task_id: str, **kwargs) -> dict:
        return _put(f"{BASE_V2}/task/{task_id}", kwargs)

    def delete_task(self, task_id: str) -> dict:
        return _delete(f"{BASE_V2}/task/{task_id}")

    def set_custom_field(self, task_id: str, field_id: str, value: Any) -> dict:
        return _post(f"{BASE_V2}/task/{task_id}/field/{field_id}", {"value": value})

    # ------------------------------------------------------------------
    # Comments
    # ------------------------------------------------------------------

    def get_task_comments(self, task_id: str) -> list:
        return _get(f"{BASE_V2}/task/{task_id}/comment").get("comments", [])

    def create_task_comment(self, task_id: str, comment_text: str, notify_all: bool = False) -> dict:
        body = {"comment_text": comment_text, "notify_all": notify_all}
        return _post(f"{BASE_V2}/task/{task_id}/comment", body)

    # ------------------------------------------------------------------
    # Time tracking
    # ------------------------------------------------------------------

    def get_time_entries(self, team_id: str, **filters) -> list:
        """
        Filters: start_date, end_date, assignee, include_task_tags,
                 include_location_names, space_id, folder_id, list_id, task_id
        """
        params = {k: v for k, v in filters.items()}
        return _get(f"{BASE_V2}/team/{team_id}/time_entries", params).get("data", [])

    def create_time_entry(self, team_id: str, task_id: str, duration: int, **kwargs) -> dict:
        """
        duration: milliseconds
        Optional: description, start (ms epoch), billable, tags, assignee
        """
        body = {"tid": task_id, "duration": duration, **kwargs}
        return _post(f"{BASE_V2}/team/{team_id}/time_entries", body).get("data", {})

    def start_timer(self, team_id: str, task_id: str, **kwargs) -> dict:
        body = {"tid": task_id, **kwargs}
        return _post(f"{BASE_V2}/team/{team_id}/time_entries/start", body).get("data", {})

    def stop_timer(self, team_id: str) -> dict:
        return _post(f"{BASE_V2}/team/{team_id}/time_entries/stop", {}).get("data", {})

    def get_running_timer(self, team_id: str) -> dict:
        return _get(f"{BASE_V2}/team/{team_id}/time_entries/current").get("data", {})

    # ------------------------------------------------------------------
    # Tags
    # ------------------------------------------------------------------

    def get_space_tags(self, space_id: str) -> list:
        return _get(f"{BASE_V2}/space/{space_id}/tag").get("tags", [])

    def add_tag_to_task(self, task_id: str, tag_name: str) -> dict:
        return _post(f"{BASE_V2}/task/{task_id}/tag/{tag_name}", {})

    def remove_tag_from_task(self, task_id: str, tag_name: str) -> dict:
        return _delete(f"{BASE_V2}/task/{task_id}/tag/{tag_name}")

    # ------------------------------------------------------------------
    # Members
    # ------------------------------------------------------------------

    def get_team_members(self, team_id: str) -> list:
        return _get(f"{BASE_V2}/team/{team_id}/member").get("members", [])

    def get_list_members(self, list_id: str) -> list:
        return _get(f"{BASE_V2}/list/{list_id}/member").get("members", [])

    # ------------------------------------------------------------------
    # Task dependencies
    # ------------------------------------------------------------------

    def get_dependencies(self, task_id: str) -> dict:
        """Returns dict with 'dependencies' and 'dependency_of' lists."""
        data = _get(f"{BASE_V2}/task/{task_id}", {"include_subtasks": "true"})
        return {
            "dependencies": data.get("dependencies", []),
            "linked_tasks": data.get("linked_tasks", []),
        }

    def add_dependency(self, task_id: str, depends_on: Optional[str] = None, waiting_on: Optional[str] = None) -> dict:
        """
        depends_on  — task_id is blocked by/waiting on this task
        waiting_on  — this task is blocking the other task
        """
        if not depends_on and not waiting_on:
            sys.exit("ERROR: provide depends_on or waiting_on")
        body: dict = {}
        if depends_on:
            body["depends_on"] = depends_on
        if waiting_on:
            body["dependency_of"] = waiting_on
        return _post(f"{BASE_V2}/task/{task_id}/dependency", body)

    def remove_dependency(self, task_id: str, depends_on: Optional[str] = None, waiting_on: Optional[str] = None) -> dict:
        if not depends_on and not waiting_on:
            sys.exit("ERROR: provide depends_on or waiting_on")
        params: dict = {}
        if depends_on:
            params["depends_on"] = depends_on
        if waiting_on:
            params["dependency_of"] = waiting_on
        return _delete(f"{BASE_V2}/task/{task_id}/dependency", params)

    # ------------------------------------------------------------------
    # Task linking (arbitrary)
    # ------------------------------------------------------------------

    def link_tasks(self, task_id: str, links_to: str) -> dict:
        return _post(f"{BASE_V2}/task/{task_id}/link/{links_to}", {})

    def unlink_tasks(self, task_id: str, links_to: str) -> dict:
        return _delete(f"{BASE_V2}/task/{task_id}/link/{links_to}")

    # ------------------------------------------------------------------
    # Documents (API v3)
    # ------------------------------------------------------------------

    def get_docs(self, workspace_id: str, **filters) -> list:
        params = {k: v for k, v in filters.items()}
        return _get(f"{BASE_V3}/workspaces/{workspace_id}/docs", params or None).get("docs", [])

    def create_doc(self, workspace_id: str, name: str, **kwargs) -> dict:
        body = {"name": name, **kwargs}
        return _post(f"{BASE_V3}/workspaces/{workspace_id}/docs", body)

    def get_doc(self, doc_id: str) -> dict:
        return _get(f"{BASE_V3}/docs/{doc_id}")

    def get_doc_pages(self, doc_id: str) -> list:
        return _get(f"{BASE_V3}/docs/{doc_id}/pages").get("pages", [])

    # ------------------------------------------------------------------
    # Chat (API v3)
    # ------------------------------------------------------------------
    # Channel ID format: the segment after /v/cn/ in ClickUp chat URLs,
    # e.g. URL .../v/cn/6-901714017941-8/t/<msg_id> → channel_id="6-901714017941-8"

    def get_chat_channel_messages(self, workspace_id: str, channel_id: str, **filters) -> list:
        """Top-level messages in a chat channel (not thread replies)."""
        params = {k: v for k, v in filters.items()}
        return _get(
            f"{BASE_V3}/workspaces/{workspace_id}/chat/channels/{channel_id}/messages",
            params or None,
        ).get("data", [])

    def get_message_replies(self, workspace_id: str, message_id: str) -> list:
        """All replies under a chat thread."""
        return _get(
            f"{BASE_V3}/workspaces/{workspace_id}/chat/messages/{message_id}/replies"
        ).get("data", [])

    def reply_to_message(
        self,
        workspace_id: str,
        message_id: str,
        content: str,
        content_format: str = "text/md",
    ) -> dict:
        """Post a reply under an existing chat message thread."""
        body = {"type": "message", "content": content, "content_format": content_format}
        return _post(
            f"{BASE_V3}/workspaces/{workspace_id}/chat/messages/{message_id}/replies",
            body,
        )

    # ------------------------------------------------------------------
    # Doc–Task linking helpers
    # ------------------------------------------------------------------

    def link_doc_to_task(self, task_id: str, doc_id: str) -> dict:
        """Attach the doc URL as a task attachment comment."""
        doc = self.get_doc(doc_id)
        doc_url = doc.get("url", f"https://app.clickup.com/docs/{doc_id}")
        comment = f"Linked document: {doc_url}"
        return self.create_task_comment(task_id, comment)

    def mention_doc_in_task(self, task_id: str, doc_id: str) -> dict:
        """Prepend a doc link to the task description."""
        doc = self.get_doc(doc_id)
        doc_url = doc.get("url", f"https://app.clickup.com/docs/{doc_id}")
        task = self.get_task(task_id)
        existing = task.get("description", "") or ""
        new_desc = f"LINKED DOCUMENT\n{doc_url}\n\n{existing}".strip()
        return self.update_task(task_id, description=new_desc)

    # ------------------------------------------------------------------
    # Reporting & analytics
    # ------------------------------------------------------------------

    def get_all_tasks(
        self,
        team_id: str,
        include_closed: bool = False,
        space_ids: Optional[list] = None,
        assignees: Optional[list] = None,
    ) -> list:
        """
        Fetch ALL tasks across the workspace with auto-pagination.
        Always includes subtasks.
        """
        all_tasks: list = []
        page = 0
        while True:
            params: dict = {
                "page": page,
                "subtasks": "true",
                "include_closed": str(include_closed).lower(),
            }
            if space_ids:
                params["space_ids[]"] = space_ids
            if assignees:
                params["assignees[]"] = assignees
            result = _get(f"{BASE_V2}/team/{team_id}/task", params)
            tasks = result.get("tasks", [])
            all_tasks.extend(tasks)
            if result.get("last_page", True) or not tasks:
                break
            page += 1
            time.sleep(RATE_LIMIT_PAUSE)
        return all_tasks

    def task_counts(self, team_id: str, **filters) -> dict:
        tasks = self.get_all_tasks(
            team_id,
            include_closed=filters.get("include_closed", False),
            space_ids=filters.get("space_ids"),
            assignees=filters.get("assignees"),
        )
        parents = [t for t in tasks if not t.get("parent")]
        subtasks = [t for t in tasks if t.get("parent")]
        unassigned = [t for t in tasks if not t.get("assignees")]
        return {
            "total": len(tasks),
            "parents": len(parents),
            "subtasks": len(subtasks),
            "unassigned": len(unassigned),
        }

    def assignee_breakdown(self, team_id: str, **filters) -> dict:
        tasks = self.get_all_tasks(
            team_id,
            include_closed=filters.get("include_closed", False),
            space_ids=filters.get("space_ids"),
        )
        counts: dict = defaultdict(int)
        for task in tasks:
            assignees = task.get("assignees", [])
            if not assignees:
                counts["Unassigned"] += 1
            for a in assignees:
                counts[a.get("username") or a.get("email", "Unknown")] += 1
        return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))

    def status_breakdown(self, team_id: str, **filters) -> dict:
        tasks = self.get_all_tasks(
            team_id,
            include_closed=filters.get("include_closed", False),
            space_ids=filters.get("space_ids"),
        )
        counts: dict = defaultdict(int)
        for task in tasks:
            status = task.get("status", {}).get("status", "unknown")
            counts[status] += 1
        return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))

    def priority_breakdown(self, team_id: str, **filters) -> dict:
        PRIORITY_MAP = {"1": "urgent", "2": "high", "3": "normal", "4": "low"}
        tasks = self.get_all_tasks(
            team_id,
            include_closed=filters.get("include_closed", False),
            space_ids=filters.get("space_ids"),
        )
        counts: dict = defaultdict(int)
        for task in tasks:
            p = task.get("priority")
            if p:
                label = p.get("priority") or PRIORITY_MAP.get(str(p.get("id", "")), "unknown")
            else:
                label = "none"
            counts[label] += 1
        return dict(counts)

    def standup_report(self, team_id: str, assignee_id: Optional[str] = None) -> dict:
        """Group tasks by status, optionally filtered to one assignee."""
        filters: dict = {}
        if assignee_id:
            filters["assignees"] = [assignee_id]
        tasks = self.get_all_tasks(team_id, **filters)
        grouped: dict = defaultdict(list)
        for task in tasks:
            status = task.get("status", {}).get("status", "unknown")
            grouped[status].append({
                "id": task.get("id"),
                "name": task.get("name"),
                "url": task.get("url"),
                "assignees": [a.get("username", a.get("email", "?")) for a in task.get("assignees", [])],
            })
        return dict(grouped)


# ---------------------------------------------------------------------------
# CLI dispatcher
# ---------------------------------------------------------------------------

def _parse_args(argv: list) -> tuple[str, dict]:
    """Parse `command key=value key2="value2" key3='[1,2]'` style CLI args."""
    if not argv:
        _print_help()
        sys.exit(0)
    command = argv[0]
    kwargs: dict = {}
    for arg in argv[1:]:
        if "=" not in arg:
            sys.exit(f"ERROR: argument '{arg}' must be in key=value format")
        key, _, val = arg.partition("=")
        # Try JSON parse first (handles lists, dicts, booleans, numbers)
        try:
            kwargs[key] = json.loads(val)
        except (json.JSONDecodeError, ValueError):
            kwargs[key] = val
    return command, kwargs


def _print_help():
    print(__doc__)


def _out(data: Any):
    print(json.dumps(data, indent=2, ensure_ascii=False, default=str))


def main():
    command, kwargs = _parse_args(sys.argv[1:])
    client = ClickUpClient()

    # Map command name → (method, required_args)
    dispatch = {
        # Workspaces
        "get_teams": lambda: client.get_teams(),

        # Spaces
        "get_spaces": lambda: client.get_spaces(**kwargs),
        "get_space": lambda: client.get_space(**kwargs),
        "create_space": lambda: client.create_space(**kwargs),
        "update_space": lambda: client.update_space(**kwargs),

        # Folders
        "get_folders": lambda: client.get_folders(**kwargs),
        "get_folder": lambda: client.get_folder(**kwargs),
        "create_folder": lambda: client.create_folder(**kwargs),
        "update_folder": lambda: client.update_folder(**kwargs),

        # Lists
        "get_lists": lambda: client.get_lists(**kwargs),
        "get_space_lists": lambda: client.get_space_lists(**kwargs),
        "get_list": lambda: client.get_list(**kwargs),
        "create_list": lambda: client.create_list(**kwargs),
        "create_space_list": lambda: client.create_space_list(**kwargs),
        "update_list": lambda: client.update_list(**kwargs),
        "get_list_fields": lambda: client.get_list_fields(**kwargs),

        # Tasks
        "get_task": lambda: client.get_task(**kwargs),
        "get_tasks": lambda: client.get_tasks(**kwargs),
        "create_task": lambda: client.create_task(**kwargs),
        "update_task": lambda: client.update_task(**kwargs),
        "delete_task": lambda: client.delete_task(**kwargs),
        "set_custom_field": lambda: client.set_custom_field(**kwargs),

        # Comments
        "get_task_comments": lambda: client.get_task_comments(**kwargs),
        "create_task_comment": lambda: client.create_task_comment(**kwargs),

        # Time tracking
        "get_time_entries": lambda: client.get_time_entries(**kwargs),
        "create_time_entry": lambda: client.create_time_entry(**kwargs),
        "start_timer": lambda: client.start_timer(**kwargs),
        "stop_timer": lambda: client.stop_timer(**kwargs),
        "get_running_timer": lambda: client.get_running_timer(**kwargs),

        # Tags
        "get_space_tags": lambda: client.get_space_tags(**kwargs),
        "add_tag_to_task": lambda: client.add_tag_to_task(**kwargs),
        "remove_tag_from_task": lambda: client.remove_tag_from_task(**kwargs),

        # Members
        "get_team_members": lambda: client.get_team_members(**kwargs),
        "get_list_members": lambda: client.get_list_members(**kwargs),

        # Dependencies
        "get_dependencies": lambda: client.get_dependencies(**kwargs),
        "add_dependency": lambda: client.add_dependency(**kwargs),
        "remove_dependency": lambda: client.remove_dependency(**kwargs),

        # Task linking
        "link_tasks": lambda: client.link_tasks(**kwargs),
        "unlink_tasks": lambda: client.unlink_tasks(**kwargs),

        # Documents
        "get_docs": lambda: client.get_docs(**kwargs),
        "create_doc": lambda: client.create_doc(**kwargs),
        "get_doc": lambda: client.get_doc(**kwargs),
        "get_doc_pages": lambda: client.get_doc_pages(**kwargs),
        "link_doc_to_task": lambda: client.link_doc_to_task(**kwargs),
        "mention_doc_in_task": lambda: client.mention_doc_in_task(**kwargs),

        # Chat
        "get_chat_channel_messages": lambda: client.get_chat_channel_messages(**kwargs),
        "get_message_replies": lambda: client.get_message_replies(**kwargs),
        "reply_to_message": lambda: client.reply_to_message(**kwargs),

        # Reporting
        "get_all_tasks": lambda: client.get_all_tasks(**kwargs),
        "task_counts": lambda: client.task_counts(**kwargs),
        "assignee_breakdown": lambda: client.assignee_breakdown(**kwargs),
        "status_breakdown": lambda: client.status_breakdown(**kwargs),
        "priority_breakdown": lambda: client.priority_breakdown(**kwargs),
        "standup_report": lambda: client.standup_report(**kwargs),
    }

    if command == "help" or command not in dispatch:
        if command not in ("help",):
            print(f"Unknown command: {command}\n")
        print("Available commands:\n  " + "\n  ".join(sorted(dispatch)))
        sys.exit(0 if command == "help" else 1)

    result = dispatch[command]()
    _out(result)


if __name__ == "__main__":
    main()
