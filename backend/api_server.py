"""
Skill API 服务 - Flask 后端

提供 RESTful API：
- POST /api/search - 检索 skills
- POST /api/execute - 执行 skill
- GET /api/skills - 获取所有 skills 列表

运行方法：
    python3 api_server.py

访问：
    http://localhost:5000
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import sys

from skill_retrieval import EmbeddingClient, SkillRetrieval
from skill_executor import SkillExecutor

app = Flask(__name__)
CORS(app)  # 允许跨域访问

# 全局变量
retrieval_system = None
skill_executor = None


def init_system():
    """初始化检索和执行系统"""
    global retrieval_system, skill_executor

    print("正在初始化系统...")

    # 1. 检查环境变量
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️  警告: 未设置 OPENAI_API_KEY，检索功能将无法使用")
        print("   请运行: export OPENAI_API_KEY=sk-xxx")
        return False

    # 2. 加载检索系统
    try:
        print("  [1/2] 加载检索索引...")
        if not os.path.exists("skill_index.json"):
            print("⚠️  未找到索引文件，请先运行: python3 test_retrieval.py --build-index")
            return False

        embedding_client = EmbeddingClient(provider="openai")
        retrieval_system = SkillRetrieval.load_index("skill_index.json", embedding_client)
        print(f"  ✓ 已加载 {len(retrieval_system.skills)} 个 skills")
    except Exception as e:
        print(f"✗ 加载检索系统失败: {e}")
        return False

    # 3. 初始化执行器
    try:
        print("  [2/2] 初始化 Skill 执行器...")

        # 自动检测可用的 LLM provider
        if os.getenv("DASHSCOPE_API_KEY"):
            provider = "bailian"
            print("  使用: 阿里云百炼")
        elif os.getenv("DEEPSEEK_API_KEY"):
            provider = "deepseek"
            print("  使用: DeepSeek")
        elif os.getenv("OPENAI_API_KEY"):
            provider = "openai"
            print("  使用: OpenAI")
        else:
            print("⚠️  警告: 未设置 LLM API Key，执行功能将无法使用")
            print("   请设置以下之一:")
            print("   - export DASHSCOPE_API_KEY=sk-xxx  (推荐)")
            print("   - export DEEPSEEK_API_KEY=sk-xxx")
            print("   - export OPENAI_API_KEY=sk-xxx")
            skill_executor = None
            return True  # 只检索也可以运行

        skill_executor = SkillExecutor(llm_provider=provider)
        print(f"  ✓ 已加载 {len(skill_executor.skill_prompts)} 个可执行 skills")
    except Exception as e:
        print(f"⚠️  初始化执行器失败: {e}")
        skill_executor = None

    print("\n✓ 系统初始化完成\n")
    return True


@app.route('/')
def index():
    """首页"""
    return send_from_directory('.', 'demo.html')


@app.route('/api/search', methods=['POST'])
def search_skills():
    """
    检索 skills

    请求体：
    {
        "query": "我要做PPT",
        "top_k": 5
    }

    返回：
    {
        "success": true,
        "results": [
            {
                "skill_id": "ppt-outline",
                "skill_name": "PPT 大纲生成",
                "score": 0.8542,
                "rank": 1,
                "promise": "...",
                "tags": ["PPT", "课程汇报"]
            }
        ]
    }
    """
    if not retrieval_system:
        return jsonify({
            "success": False,
            "error": "检索系统未初始化"
        }), 500

    try:
        data = request.json
        query = data.get('query', '')
        top_k = data.get('top_k', 5)

        if not query:
            return jsonify({
                "success": False,
                "error": "query 参数不能为空"
            }), 400

        # 检索
        results = retrieval_system.search(query, top_k=top_k)

        # 格式化结果
        formatted_results = []
        for result in results:
            skill = retrieval_system.skills[result.skill_id]
            formatted_results.append({
                "skill_id": result.skill_id,
                "skill_name": result.skill_name,
                "score": result.score,
                "rank": result.rank,
                "promise": skill.promise,
                "tags": skill.tags,
                "scene": skill.scene,
                "credits": skill.credits,
                "users": skill.users,
                "rating": skill.rating,
            })

        return jsonify({
            "success": True,
            "query": query,
            "results": formatted_results
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/execute', methods=['POST'])
def execute_skill():
    """
    执行 skill

    请求体：
    {
        "skill_id": "excel-formula",
        "user_input": {
            "formula": "=VLOOKUP(A2, Sheet2!A:C, 3, FALSE)"
        }
    }

    返回：
    {
        "success": true,
        "output": "...",
        "credits_used": 15
    }
    """
    if not skill_executor:
        return jsonify({
            "success": False,
            "error": "执行器未初始化，请配置 LLM API Key"
        }), 500

    try:
        data = request.json
        skill_id = data.get('skill_id', '')
        user_input = data.get('user_input', {})

        if not skill_id:
            return jsonify({
                "success": False,
                "error": "skill_id 参数不能为空"
            }), 400

        # 执行
        result = skill_executor.execute(skill_id, user_input)

        if result.success:
            return jsonify({
                "success": True,
                "skill_id": skill_id,
                "output": result.output,
                "credits_used": result.credits_used
            })
        else:
            return jsonify({
                "success": False,
                "error": result.error
            }), 400

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/skills', methods=['GET'])
def list_skills():
    """
    获取所有 skills 列表

    返回：
    {
        "success": true,
        "total": 30,
        "skills": [...]
    }
    """
    if not retrieval_system:
        return jsonify({
            "success": False,
            "error": "检索系统未初始化"
        }), 500

    try:
        skills = []
        for skill_id, skill in retrieval_system.skills.items():
            skills.append({
                "id": skill.id,
                "name": skill.name,
                "promise": skill.promise,
                "scene": skill.scene,
                "tags": skill.tags,
                "credits": skill.credits,
                "users": skill.users,
                "rating": skill.rating,
                "is_executable": skill_id in (skill_executor.skill_prompts if skill_executor else {})
            })

        return jsonify({
            "success": True,
            "total": len(skills),
            "executable": len(skill_executor.skill_prompts) if skill_executor else 0,
            "skills": skills
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        "status": "ok",
        "retrieval_ready": retrieval_system is not None,
        "executor_ready": skill_executor is not None,
        "skills_loaded": len(retrieval_system.skills) if retrieval_system else 0,
        "executable_skills": len(skill_executor.skill_prompts) if skill_executor else 0
    })


if __name__ == '__main__':
    # 初始化系统
    if not init_system():
        print("\n系统初始化失败，部分功能将不可用")
        print("但服务器仍会启动，你可以访问 http://localhost:5000 查看状态\n")

    # 启动服务器
    print("=" * 60)
    print("Skill API 服务器启动")
    print("=" * 60)
    print("访问地址: http://localhost:5000")
    print("API 文档: http://localhost:5000/api/health")
    print("\n按 Ctrl+C 停止服务器\n")

    app.run(host='0.0.0.0', port=5000, debug=True)
