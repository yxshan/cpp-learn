#include <iostream>
#include <queue>

int main() {
    std::queue<int> values;
    values.push(10);
    values.push(20);
    values.push(30);

    while (!values.empty()) {
        std::cout << values.front();
        values.pop();
        std::cout << (values.empty() ? '\n' : ' ');
    }
}
