#include <iostream>
#include <queue>
#include <vector>

int main() {
    std::priority_queue<int> values;
    for (const int value : std::vector{5, 2, 9}) {
        values.push(value);
    }

    while (!values.empty()) {
        std::cout << values.top();
        values.pop();
        std::cout << (values.empty() ? '\n' : ' ');
    }
}
