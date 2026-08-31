#include <iostream>
#include <string>
#include <utility>

int main() {
    const std::pair<std::string, int> response{"ok", 200};
    int left = 1;
    int right = 2;
    std::swap(left, right);

    std::cout << response.first << '=' << response.second << '\n';
    std::cout << "left=" << left << " right=" << right << '\n';
}
