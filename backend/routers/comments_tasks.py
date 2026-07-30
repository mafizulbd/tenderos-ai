"""Comment and task routes."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from deps import _notify, _parse_deadline, get_current_membership, get_db
from models import Comment, Contract, OrgMembership, Task as TaskModel, Tender, User, Vendor
from schemas import CommentCreate, CommentUpdate, TaskCreate, TaskUpdate

router = APIRouter()

# ---------------------------------------------------------------------------
# Comments & Tasks
# ---------------------------------------------------------------------------

VALID_ENTITY_TYPES = {"tender", "vendor", "contract"}
VALID_TASK_STATUSES = {"open", "in_progress", "done", "cancelled"}


def _validate_entity(entity_type: str, entity_id: int, organization_id: int, db: Session) -> None:
    if entity_type not in VALID_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported entity_type. Must be one of: {', '.join(sorted(VALID_ENTITY_TYPES))}",
        )
    if entity_type == "tender":
        exists = db.query(Tender).filter(
            Tender.id == entity_id, Tender.organization_id == organization_id
        ).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Tender not found.")
    elif entity_type == "vendor":
        exists = db.query(Vendor).filter(
            Vendor.id == entity_id, Vendor.organization_id == organization_id
        ).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Vendor not found.")
    elif entity_type == "contract":
        exists = db.query(Contract).filter(
            Contract.id == entity_id, Contract.organization_id == organization_id
        ).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Contract not found.")


def _users_by_id(user_ids: list[int | None], db: Session) -> dict[int, User]:
    ids = [uid for uid in user_ids if uid is not None]
    if not ids:
        return {}
    return {u.id: u for u in db.query(User).filter(User.id.in_(ids)).all()}


def _comment_response(c: Comment, users: dict[int, User]) -> dict:
    author = users.get(c.author_user_id)
    return {
        "id": c.id,
        "entity_type": c.entity_type,
        "entity_id": c.entity_id,
        "author_user_id": c.author_user_id,
        "author_email": author.email if author else "",
        "body": c.body,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


def _task_response(t: TaskModel, users: dict[int, User]) -> dict:
    assignee = users.get(t.assignee_user_id) if t.assignee_user_id else None
    creator = users.get(t.created_by_user_id)
    return {
        "id": t.id,
        "entity_type": t.entity_type,
        "entity_id": t.entity_id,
        "title": t.title,
        "description": t.description or "",
        "assignee_user_id": t.assignee_user_id,
        "assignee_email": assignee.email if assignee else "",
        "created_by_user_id": t.created_by_user_id,
        "created_by_email": creator.email if creator else "",
        "status": t.status,
        "due_date": t.due_date,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


@router.get("/comments")
def list_comments(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    _validate_entity(entity_type, entity_id, membership.organization_id, db)
    comments = (
        db.query(Comment)
        .filter(
            Comment.organization_id == membership.organization_id,
            Comment.entity_type == entity_type,
            Comment.entity_id == entity_id,
        )
        .order_by(Comment.id.asc())
        .all()
    )
    users = _users_by_id([c.author_user_id for c in comments], db)
    return [_comment_response(c, users) for c in comments]


def _entity_owner_user_id(entity_type: str, entity_id: int, db: Session) -> int | None:
    if entity_type == "tender":
        row = db.query(Tender).filter(Tender.id == entity_id).first()
        return row.user_id if row else None
    if entity_type == "vendor":
        row = db.query(Vendor).filter(Vendor.id == entity_id).first()
        return row.created_by_user_id if row else None
    if entity_type == "contract":
        row = db.query(Contract).filter(Contract.id == entity_id).first()
        return row.created_by_user_id if row else None
    return None


def _entity_title(entity_type: str, entity_id: int, db: Session) -> str:
    if entity_type == "tender":
        row = db.query(Tender).filter(Tender.id == entity_id).first()
        return row.title if row else "tender"
    if entity_type == "vendor":
        row = db.query(Vendor).filter(Vendor.id == entity_id).first()
        return row.name if row else "vendor"
    if entity_type == "contract":
        row = db.query(Contract).filter(Contract.id == entity_id).first()
        return row.title if row else "contract"
    return entity_type


@router.post("/comments")
def create_comment(
    payload: CommentCreate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment body is required.")
    _validate_entity(payload.entity_type, payload.entity_id, membership.organization_id, db)

    comment = Comment(
        organization_id=membership.organization_id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        author_user_id=membership.user_id,
        body=body,
    )
    db.add(comment)

    owner_id = _entity_owner_user_id(payload.entity_type, payload.entity_id, db)
    if owner_id and owner_id != membership.user_id:
        _notify(
            db, membership.organization_id, owner_id, "comment_added",
            title=f'New comment on "{_entity_title(payload.entity_type, payload.entity_id, db)}"',
            message=body[:200],
            entity_type=payload.entity_type, entity_id=payload.entity_id,
        )

    db.commit()
    db.refresh(comment)
    return _comment_response(comment, _users_by_id([comment.author_user_id], db))


@router.patch("/comments/{comment_id}")
def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    comment = db.query(Comment).filter(
        Comment.id == comment_id, Comment.organization_id == membership.organization_id
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")
    if comment.author_user_id != membership.user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments.")

    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment body is required.")
    comment.body = body
    comment.updated_at = datetime.utcnow()
    db.commit()
    return _comment_response(comment, _users_by_id([comment.author_user_id], db))


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    comment = db.query(Comment).filter(
        Comment.id == comment_id, Comment.organization_id == membership.organization_id
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")
    if comment.author_user_id != membership.user_id and membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="You can only delete your own comments.")

    db.delete(comment)
    db.commit()
    return {"detail": "Comment deleted."}


def _can_modify_task(task: TaskModel, membership: OrgMembership) -> bool:
    return (
        membership.role in ("owner", "admin")
        or task.created_by_user_id == membership.user_id
        or task.assignee_user_id == membership.user_id
    )


@router.get("/tasks")
def list_tasks(
    entity_type: str | None = None,
    entity_id: int | None = None,
    assignee_user_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    query = db.query(TaskModel).filter(TaskModel.organization_id == membership.organization_id)
    if entity_type is not None:
        query = query.filter(TaskModel.entity_type == entity_type)
    if entity_id is not None:
        query = query.filter(TaskModel.entity_id == entity_id)
    if assignee_user_id is not None:
        query = query.filter(TaskModel.assignee_user_id == assignee_user_id)
    if status is not None:
        query = query.filter(TaskModel.status == status)

    tasks = query.order_by(TaskModel.id.desc()).all()
    users = _users_by_id(
        [t.assignee_user_id for t in tasks if t.assignee_user_id] + [t.created_by_user_id for t in tasks], db
    )
    return [_task_response(t, users) for t in tasks]


@router.get("/tasks/mine")
def list_my_tasks(
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    tasks = (
        db.query(TaskModel)
        .filter(
            TaskModel.organization_id == membership.organization_id,
            TaskModel.assignee_user_id == membership.user_id,
        )
        .order_by(TaskModel.id.desc())
        .all()
    )
    users = _users_by_id(
        [t.assignee_user_id for t in tasks] + [t.created_by_user_id for t in tasks], db
    )
    return [_task_response(t, users) for t in tasks]


@router.post("/tasks")
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Task title is required.")
    if payload.entity_type is not None:
        if payload.entity_id is None:
            raise HTTPException(status_code=400, detail="entity_id is required when entity_type is set.")
        _validate_entity(payload.entity_type, payload.entity_id, membership.organization_id, db)

    task = TaskModel(
        organization_id=membership.organization_id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        title=title,
        description=payload.description,
        assignee_user_id=payload.assignee_user_id,
        created_by_user_id=membership.user_id,
        status="open",
        due_date=_parse_deadline(payload.due_date),
    )
    db.add(task)

    if payload.assignee_user_id and payload.assignee_user_id != membership.user_id:
        _notify(
            db, membership.organization_id, payload.assignee_user_id, "task_assigned",
            title=f'You were assigned: "{title}"',
            entity_type=payload.entity_type, entity_id=payload.entity_id,
        )

    db.commit()
    db.refresh(task)
    return _task_response(task, _users_by_id([task.assignee_user_id, task.created_by_user_id], db))


@router.patch("/tasks/{task_id}")
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    task = db.query(TaskModel).filter(
        TaskModel.id == task_id, TaskModel.organization_id == membership.organization_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    if not _can_modify_task(task, membership):
        raise HTTPException(status_code=403, detail="You can only edit tasks you created or are assigned to.")

    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Task title is required.")
        task.title = title
    if payload.description is not None:
        task.description = payload.description
    if payload.assignee_user_id is not None:
        reassigned = payload.assignee_user_id != task.assignee_user_id
        task.assignee_user_id = payload.assignee_user_id
        if reassigned and payload.assignee_user_id != membership.user_id:
            _notify(
                db, membership.organization_id, payload.assignee_user_id, "task_assigned",
                title=f'You were assigned: "{task.title}"',
                entity_type=task.entity_type, entity_id=task.entity_id,
            )
    if payload.status is not None:
        if payload.status not in VALID_TASK_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_TASK_STATUSES))}")
        task.status = payload.status
    if payload.due_date is not None:
        task.due_date = _parse_deadline(payload.due_date)

    task.updated_at = datetime.utcnow()
    db.commit()
    return _task_response(task, _users_by_id([task.assignee_user_id, task.created_by_user_id], db))


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    membership: OrgMembership = Depends(get_current_membership),
):
    task = db.query(TaskModel).filter(
        TaskModel.id == task_id, TaskModel.organization_id == membership.organization_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    if task.created_by_user_id != membership.user_id and membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="You can only delete tasks you created.")

    db.delete(task)
    db.commit()
    return {"detail": "Task deleted."}
