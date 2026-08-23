#include <iostream>
#include <string>

int main()
{
    std::string name;
    int minutes{};
    constexpr int session_minutes{25};

    std::cout << "你的名字：";
    std::getline(std::cin, name);

    std::cout << "今天可学习多少分钟：";
    std::cin >> minutes;

    const int complete_sessions{minutes / session_minutes};
    const int remaining_minutes{minutes % session_minutes};

    // TODO: 输出两行：
    // 欢迎，<名字>！
    // 你可以完成 <完整番茄钟数> 个完整番茄钟，还剩 <分钟数> 分钟。
    std::cout << "欢迎，" << name << "！\n";
    std::cout << "你可以完成 " << complete_sessions << " 个完整番茄钟，还剩 " << remaining_minutes << " 分钟\n";

    return 0;
}
